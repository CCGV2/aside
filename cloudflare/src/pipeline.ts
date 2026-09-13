import { enabled } from "./trial.js";
import { makeAnalysis, type AnalysisPort } from "@aside/engine/server";
import type { Episode, Passage } from "@aside/engine/core";
import { AudioProvider } from "../../backend/src/audio-provider.js";
import { CloudStore } from "./store.js";
import type { Env } from "./env.js";
export interface Manifest {
  durationMs: number;
  mimeType: string;
  pauses: { startMs: number; endMs: number }[];
  plan: { offsetMs: number; durationMs: number }[];
}
export interface Steps {
  do(name: string, callback: () => Promise<string>): Promise<string>;
}
export interface MediaProcessor {
  prepare(id: string): Promise<Manifest>;
  chunk(id: string, index: number): Promise<Uint8Array>;
  cleanup(id: string): Promise<void>;
}
/** Step outputs are keys; structured records live in D1, audio bytes in R2. */
export async function analyzeEpisode(
  env: Pick<Env, "DB" | "AUDIO" | "OPENAI_API_KEY" | "AI_ENABLED">,
  id: string,
  step: Steps,
  media: MediaProcessor,
  suppliedProvider?: AudioProvider,
) {
  const store = new CloudStore(env.DB, env.AUDIO);
  const prefix = `episodes/${id}/analysis-v1`;
  const read = async <T>(key: string): Promise<T> => {
    const value = await store.records.get<T>(key);
    if (value === undefined) throw Error("Missing analysis artifact");
    return value;
  };
  const write = (key: string, value: unknown) => store.records.put(key, value);
  async function update(
    stage: string,
    progress: number,
    status: Episode["status"] = "analyzing",
  ) {
    const row = await store.row(id);
    const episode = JSON.parse(row.metadata) as Episode;
    episode.stage = stage;
    episode.progress = progress;
    episode.status = status;
    delete episode.error;
    await store.update(episode);
    return episode;
  }
  try {
    if (!env.OPENAI_API_KEY && !suppliedProvider)
      throw Error("Analysis provider not configured");
    const provider = suppliedProvider ?? new AudioProvider(env.OPENAI_API_KEY!);
    await step.do("prepare", async () => {
      await update("检查音频与分块", 0.02);
      const key = `${prefix}/manifest.json`;
      if (!(await store.records.has(key)))
        await write(key, await media.prepare(id));
      return key;
    });
    const manifest = await read<Manifest>(`${prefix}/manifest.json`);
    {
      const row = await store.row(id);
      const episode = JSON.parse(row.metadata) as Episode;
      await store.update({
        ...episode,
        durationMs: manifest.durationMs,
        mimeType: manifest.mimeType,
        stage: "正在自动分析",
        status: "analyzing",
      });
    }
    for (let i = 0; i < manifest.plan.length; i++) {
      const chunk = `${prefix}/chunk-${i}.mp3`,
        transcript = `${prefix}/transcript-${i}.json`,
        enriched = `${prefix}/enriched-${i}.json`;
      await step.do(`encode-${i}`, async () => {
        await store.row(id);
        if (!(await env.AUDIO.head(chunk))) {
          const bytes = await media.chunk(id, i);
          await store.row(id);
          await env.AUDIO.put(chunk, bytes, {
            httpMetadata: { contentType: "audio/mpeg" },
          });
        }
        return chunk;
      });
      await step.do(`transcribe-${i}`, async () => {
        await update(
          `转录第 ${i + 1}/${manifest.plan.length} 段`,
          0.05 + (0.85 * i) / manifest.plan.length,
        );
        if (!(await store.records.has(transcript))) {
          await store.row(id);
          if (!(await enabled(env))) throw Error("AI processing disabled");
          const object = await env.AUDIO.get(chunk);
          if (!object) throw Error("Missing audio chunk");
          const passages = await provider.transcribeAudio(
            new Uint8Array(await object.arrayBuffer()),
            manifest.plan[i].offsetMs,
          );
          await store.row(id);
          await write(transcript, passages);
        }
        return transcript;
      });
      await step.do(`enrich-${i}`, async () => {
        await update(
          `分析第 ${i + 1}/${manifest.plan.length} 段`,
          0.05 + (0.85 * (i + 0.5)) / manifest.plan.length,
        );
        if (!(await store.records.has(enriched))) {
          await store.row(id);
          if (!(await enabled(env))) throw Error("AI processing disabled");
          const object = await env.AUDIO.get(chunk);
          if (!object) throw Error("Missing audio chunk");
          const evidence = `${prefix}/evidence-${i}-${crypto.randomUUID()}.json`;
          const info = await provider.enrichAudio(
            new Uint8Array(await object.arrayBuffer()),
            await read<Passage[]>(transcript),
            async (value) => {
              await store.row(id);
              await store.records.put(evidence, value);
            },
          );
          await store.row(id);
          await write(enriched, info);
        }
        return enriched;
      });
    }
    await step.do("assemble", async () => {
      const all: Passage[] = [];
      const info: Awaited<ReturnType<AnalysisPort["enrich"]>> = {
        summary: "",
        hostStyle: "",
        speakers: [],
        groups: [],
      };
      for (let i = 0; i < manifest.plan.length; i++) {
        all.push(...(await read<Passage[]>(`${prefix}/transcript-${i}.json`)));
        const next = await read<typeof info>(`${prefix}/enriched-${i}.json`);
        info.summary += next.summary + "\n";
        info.hostStyle += next.hostStyle + "\n";
        info.speakers.push(
          ...next.speakers.map((s) => ({ ...s, id: `${i}-${s.id}` })),
        );
        info.groups.push(...next.groups);
      }
      if (!all.length) throw Error("No speech found");
      const analysis = makeAnalysis(all, {
        ...info,
        hostStyle: info.hostStyle.slice(0, 3000),
      });
      for (const anchor of analysis.anchors) {
        const pause = manifest.pauses
          .filter(
            (p) =>
              p.endMs <= anchor.startMs + 120 &&
              p.endMs >= anchor.startMs - 350,
          )
          .at(-1);
        if (pause)
          anchor.startMs = Math.max(
            pause.startMs,
            Math.min(anchor.startMs, pause.endMs - 50),
          );
      }
      const key = `${prefix}/complete.json`;
      await write(key, analysis);
      const row = await store.row(id),
        episode = JSON.parse(row.metadata) as Episode;
      await store.update(
        {
          ...episode,
          durationMs: manifest.durationMs,
          mimeType: manifest.mimeType,
          status: "ready",
          stage: "分析完成",
          progress: 1,
          error: undefined,
        },
        key,
      );
      return key;
    });
  } catch (error) {
    await step.do("record-failure", async () => {
      const row = await store.row(id),
        episode = JSON.parse(row.metadata) as Episode;
      if (episode.status !== "ready" && episode.status !== "blocked")
        await store.update({
          ...episode,
          status: "failed",
          stage: "分析未完成",
          error: "分析失败，已完成分段可以复用，请重试。",
        });
      return id;
    });
    throw error;
  } finally {
    // Cleanup is best effort; failure must not turn a completed analysis into a failed one.
    await media.cleanup(id).catch(() => {});
  }
}
