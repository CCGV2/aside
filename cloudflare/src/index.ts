import { Container, getContainer } from "@cloudflare/containers";
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import type { Env, AnalysisJob } from "./env.js";
import {
  analyzeEpisode,
  type Manifest,
  type MediaProcessor,
} from "./pipeline.js";
import { CloudStore } from "./store.js";
export { default } from "./api.js";
export class MediaContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "5m";
}
export class EpisodeAnalysis extends WorkflowEntrypoint<Env, AnalysisJob> {
  async run(event: WorkflowEvent<AnalysisJob>, step: WorkflowStep) {
    const id = event.payload.episodeId;
    const instance = getContainer(
      this.env.MEDIA,
      `media-${parseInt(id.slice(0, 8), 16) % 2}`,
    );
    const prepare = async (): Promise<Manifest> => {
      const source = await this.env.AUDIO.get(`episodes/${id}/original`);
      if (!source) throw Error("Missing original audio");
      const result = await instance.fetch(
        new Request(`http://media/prepare?id=${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: source.body,
        }),
      );
      if (result.status === 422) {
        const detail = (await result.json().catch(() => null)) as { error?: string } | null;
        const store = new CloudStore(this.env.DB, this.env.AUDIO);
        const row = await store.row(id);
        const episode = JSON.parse(row.metadata);
        await store.update({
          ...episode,
          status: "blocked",
          stage: "音频不符合上传要求",
          error: detail?.error ?? "文件不包含可处理的音频",
        });
        await this.env.DB.prepare("UPDATE uploads SET state='rejected' WHERE id=?")
          .bind(id).run();
        await this.env.AUDIO.delete(`episodes/${id}/original`);
        await this.env.DB.prepare("DELETE FROM uploads WHERE id=? AND state='rejected'")
          .bind(id).run();
        throw new NonRetryableError("Audio admission rejected");
      }
      if (!result.ok) throw Error("Audio preparation failed");
      return result.json<Manifest>();
    };
    const media: MediaProcessor = {
      prepare,
      chunk: async (_id, index) => {
        const request = () =>
          instance.fetch(
            new Request(`http://media/chunk?id=${id}&index=${index}`),
          );
        let result = await request();
        if (result.status === 409) {
          await prepare();
          result = await request();
        }
        if (!result.ok || !result.body) throw Error("Audio encoding failed");
        return new Uint8Array(await result.arrayBuffer());
      },
      cover: async () => {
        const request = () =>
          instance.fetch(new Request(`http://media/cover?id=${id}`));
        let result = await request();
        if (result.status === 409) {
          await prepare();
          result = await request();
        }
        if (result.status === 404) return undefined;
        if (!result.ok) throw Error("Cover extraction failed");
        return new Uint8Array(await result.arrayBuffer());
      },
      cleanup: async () => {
        await instance.fetch(
          new Request(`http://media/source?id=${id}`, { method: "DELETE" }),
        );
      },
    };
    await analyzeEpisode(
      this.env,
      id,
      {
        do: (name, callback) =>
          step.do(
            name,
            {
              retries: {
                limit: 3,
                delay: "30 seconds",
                backoff: "exponential",
              },
              timeout: name === "prepare" ? "30 minutes" : "5 minutes",
            },
            callback,
          ),
      },
      media,
    );
  }
}

export { LiveSupervisor } from "./live-supervisor.js";
