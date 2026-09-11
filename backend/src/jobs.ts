import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { makeAnalysis, type AnalysisPort } from "@aside/engine/server";
import type { Passage } from "@aside/engine/core";
import { Store } from "./store.js";
import { findSilences, planChunks } from "./media.js";
const exec = promisify(execFile);
export async function probeAudio(path: string) {
  const { stdout } = await exec("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration,format_name:stream=codec_type",
    "-of",
    "json",
    path,
  ]);
  const metadata = JSON.parse(stdout);
  if (
    !metadata.streams?.some(
      (s: { codec_type: string }) => s.codec_type === "audio",
    )
  )
    throw Error("文件中没有音轨");
  const duration = Number(metadata.format.duration);
  if (!Number.isFinite(duration) || duration <= 0)
    throw Error("无法读取有效音频时长");
  const format = String(metadata.format.format_name);
  const mimeType = format.includes("mp3")
    ? "audio/mpeg"
    : format.includes("wav")
      ? "audio/wav"
      : format.includes("ogg")
        ? "audio/ogg"
        : format.includes("flac")
          ? "audio/flac"
          : format.includes("webm")
            ? "audio/webm"
            : format.includes("mov") || format.includes("mp4")
              ? "audio/mp4"
              : "application/octet-stream";
  return { durationMs: Math.round(duration * 1000), mimeType };
}
export async function probe(path: string) {
  return (await probeAudio(path)).durationMs;
}
export class Jobs {
  private running = false;
  constructor(
    private store: Store,
    private provider?: AnalysisPort,
  ) {}
  async start() {
    for (const e of this.store.list())
      if (e.status === "analyzing") {
        e.status = "queued";
        e.stage = "等待恢复分析";
        this.store.put(e);
      }
    void this.drain();
  }
  async drain() {
    if (this.running) return;
    this.running = true;
    try {
      for (const e of this.store.list().filter((e) => e.status === "queued")) {
        if (!this.provider) {
          this.store.put({
            ...e,
            status: "blocked",
            stage: "等待配置 OpenAI",
            error: "服务端尚未配置 OPENAI_API_KEY；原音频已保存。",
          });
          continue;
        }
        const dir = this.store.dir(e.id);
        const update = (stage: string, progress: number) => {
          e.status = "analyzing";
          e.stage = stage;
          e.progress = progress;
          delete e.error;
          this.store.put(e);
        };
        try {
          update("检查音频", 0.02);
          e.durationMs = await probe(join(dir, "original"));
          let pauses: { startMs: number; endMs: number }[];
          try {
            pauses = JSON.parse(
              await readFile(join(dir, "silences-v1.json"), "utf8"),
            );
          } catch {
            update("检测停顿与分块位置", 0.03);
            pauses = await findSilences(join(dir, "original"));
            await writeFile(
              join(dir, "silences-v1.json"),
              JSON.stringify(pauses),
            );
          }
          const plan = planChunks(e.durationMs, pauses);
          const chunks = plan.length;
          const all: Passage[] = [];
          const info: Awaited<ReturnType<AnalysisPort["enrich"]>> = {
            summary: "",
            hostStyle: "",
            speakers: [],
            groups: [],
          };
          for (let i = 0; i < chunks; i++) {
            const offset = plan[i].offsetMs;
            const audio = join(dir, `chunk-${i}.mp3`);
            const checkpoint = join(dir, `analysis-v1-${i}.json`);
            let saved: { passages: Passage[]; info: typeof info } | undefined;
            try {
              saved = JSON.parse(await readFile(checkpoint, "utf8"));
            } catch {}
            if (!saved) {
              update(
                `转录第 ${i + 1}/${chunks} 段`,
                0.05 + (0.85 * i) / chunks,
              );
              await exec(
                "ffmpeg",
                [
                  "-y",
                  "-v",
                  "error",
                  "-ss",
                  String(offset / 1000),
                  "-i",
                  join(dir, "original"),
                  "-t",
                  String(plan[i].durationMs / 1000),
                  "-vn",
                  "-ac",
                  "1",
                  "-ar",
                  "24000",
                  "-b:a",
                  "48k",
                  audio,
                ],
                { timeout: 120000 },
              );
              let passages: Passage[];
              try {
                passages = JSON.parse(
                  await readFile(join(dir, `transcript-v1-${i}.json`), "utf8"),
                );
              } catch {
                passages = await this.provider.transcribe(audio, offset);
                await writeFile(
                  join(dir, `transcript-v1-${i}.json`),
                  JSON.stringify(passages),
                );
              }
              update(
                `分析语义与声音 ${i + 1}/${chunks}`,
                0.05 + (0.85 * (i + 0.5)) / chunks,
              );
              saved = {
                passages,
                info: await this.provider.enrich(audio, passages),
              };
              await writeFile(checkpoint, JSON.stringify(saved));
            }
            all.push(...saved.passages);
            info.summary += saved.info.summary + "\n";
            info.hostStyle += saved.info.hostStyle + "\n";
            info.speakers.push(
              ...saved.info.speakers.map((s) => ({ ...s, id: `${i}-${s.id}` })),
            );
            info.groups.push(...saved.info.groups);
          }
          if (!all.length) throw Error("没有识别到语音");
          e.analysis = makeAnalysis(all, {
            ...info,
            hostStyle: info.hostStyle.slice(0, 3000),
          });
          for (const anchor of e.analysis.anchors) {
            const pause = pauses
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
          e.status = "ready";
          e.stage = "分析完成";
          e.progress = 1;
          this.store.put(e);
        } catch (err) {
          const failedStage = e.stage;
          e.status = "failed";
          e.stage = `分析未完成 · ${failedStage}`;
          e.error = err instanceof Error ? err.message : "分析失败";
          this.store.put(e);
        }
      }
    } finally {
      this.running = false;
      if (this.store.list().some((e) => e.status === "queued"))
        void this.drain();
    }
  }
}
