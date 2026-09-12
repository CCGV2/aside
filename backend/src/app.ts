import { PassThrough } from "node:stream";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { mkdir, stat, readFile, writeFile, rename, rm } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";
import { z } from "zod";
import type { Episode } from "@aside/engine/core";
import { questionSchema, liveSchema, checkpointSchema } from "./contracts.js";
import { Store } from "./store.js";
import type { BackendServices } from "./services.js";
import {
  questionEventSchema,
  questionResultSchema,
  type QuestionEvent,
} from "@aside/engine/contracts";
import { Jobs, probeAudio } from "./jobs.js";
import { readMicrophoneConfig, readVoiceLifecycleConfig } from "./config.js";
export function createApp(store: Store, services?: BackendServices) {
  const microphone = readMicrophoneConfig();
  const voiceLifecycle = readVoiceLifecycleConfig();
  const app = Fastify({ logger: false, bodyLimit: 256000 });
  const jobs = new Jobs(store, services?.analysis);
  app.register(multipart, {
    limits: { fileSize: 500 * 1024 * 1024, files: 1, parts: 2 },
  });
  app.addHook("onRequest", async (req, reply) => {
    const origin = req.headers.origin;
    if (
      origin &&
      ![
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4310",
        "http://localhost:4310",
      ].includes(origin)
    )
      return reply.code(403).send({ error: "Unexpected origin" });
  });
  app.setErrorHandler((error, _req, reply) => {
    reply.code(error instanceof z.ZodError ? 400 : 400).send({
      error: error instanceof Error ? error.message : "Request failed",
    });
  });
  const get = (id: string) => {
    const e = store.get(id);
    if (!e) throw Error("节目不存在");
    return e;
  };
  app.get("/api/health", async () => ({
    ok: true,
    liveConfigured: !!services,
    model: "gpt-live-1",
    microphone,
    voiceLifecycle,
  }));
  app.get("/api/episodes", async () =>
    store
      .list()
      .map(({ analysis, ...e }) => ({ ...e, voice: analysis?.voice })),
  );
  app.get<{ Params: { id: string } }>("/api/episodes/:id", async (req) =>
    get(req.params.id),
  );
  app.post("/api/episodes", async (req, reply) => {
    const file = await req.file();
    if (!file) throw Error("请选择音频文件");
    const id = crypto.randomUUID();
    const dir = store.dir(id);
    await mkdir(dir, { recursive: true });
    try {
      await pipeline(file.file, createWriteStream(join(dir, "upload")));
      if (file.file.truncated) throw Error("音频超过 500 MB");
      await rename(join(dir, "upload"), join(dir, "original"));
      const { durationMs, mimeType } = await probeAudio(join(dir, "original"));
      const e: Episode = {
        id,
        title: file.filename.replace(/\.[^.]+$/, "").slice(0, 200),
        createdAt: new Date().toISOString(),
        durationMs,
        mimeType,
        status: "queued",
        stage: "等待分析",
        progress: 0,
      };
      store.put(e);
      void jobs.drain();
      return reply.code(201).send(e);
    } catch (err) {
      await rm(dir, { recursive: true, force: true });
      throw err;
    }
  });
  app.post<{ Params: { id: string } }>(
    "/api/episodes/:id/retry",
    async (req) => {
      const e = get(req.params.id);
      if (!["failed", "blocked"].includes(e.status))
        throw Error("当前任务不能重试");
      e.status = "queued";
      delete e.error;
      store.put(e);
      void jobs.drain();
      return e;
    },
  );
  app.get<{ Params: { id: string } }>(
    "/api/episodes/:id/audio",
    async (req, reply) => {
      const episode = get(req.params.id);
      const path = join(store.dir(req.params.id), "original");
      const { size } = await stat(path);
      reply
        .header("Accept-Ranges", "bytes")
        .type(episode.mimeType ?? "audio/mpeg");
      const range = req.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2]))
          return reply
            .code(416)
            .header("Content-Range", `bytes */${size}`)
            .send();
        let start = match[1]
          ? Number(match[1])
          : Math.max(0, size - Number(match[2]));
        let end = match[1]
          ? match[2]
            ? Math.min(Number(match[2]), size - 1)
            : size - 1
          : size - 1;
        if (start >= size || end < start)
          return reply
            .code(416)
            .header("Content-Range", `bytes */${size}`)
            .send();
        return reply
          .code(206)
          .header("Content-Range", `bytes ${start}-${end}/${size}`)
          .header("Content-Length", end - start + 1)
          .send(createReadStream(path, { start, end }));
      }
      return reply.header("Content-Length", size).send(createReadStream(path));
    },
  );
  app.get<{ Params: { id: string } }>(
    "/api/episodes/:id/checkpoint",
    async (req) => {
      get(req.params.id);
      return store.checkpoint(req.params.id);
    },
  );
  app.put<{ Params: { id: string } }>(
    "/api/episodes/:id/checkpoint",
    async (req) => {
      const e = get(req.params.id);
      const data = checkpointSchema.parse(req.body);
      data.positionMs = Math.min(data.positionMs, e.durationMs);
      if (data.resumeMs !== undefined)
        data.resumeMs = Math.min(data.resumeMs, e.durationMs);
      return store.checkpoint(req.params.id, data);
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/episodes/:id/question",
    async (req, reply) => {
      const e = get(req.params.id);
      if (!e.analysis) throw Error("节目尚未完成分析");
      if (!services)
        return reply
          .code(503)
          .send({ error: "请在本地 .env 配置 OPENAI_API_KEY 后重启后端" });
      const q = questionSchema.parse(req.body);
      const controller = new AbortController();
      req.raw.on("aborted", () => controller.abort());
      const onClose = () => {
        if (!reply.raw.writableEnded) controller.abort();
      };
      reply.raw.on("close", onClose);
      const taskPath = join(
        store.dir(e.id),
        `question-${crypto.randomUUID()}.json`,
      );
      await writeFile(
        taskPath,
        JSON.stringify({
          status: "running",
          revision: q.revision,
          history: q.history,
          atMs: q.atMs,
        }),
      );
      const streaming = req.headers.accept?.includes("application/x-ndjson");
      const stream = streaming ? new PassThrough() : undefined;
      const send = (event: QuestionEvent) => {
        if (stream && !stream.destroyed && !controller.signal.aborted)
          stream.write(JSON.stringify(questionEventSchema.parse(event)) + "\n");
      };
      if (stream)
        reply
          .header("Content-Type", "application/x-ndjson")
          .header("Cache-Control", "no-cache")
          .send(stream);
      try {
        const result = questionResultSchema.parse(
          await services.questions.answer(
            e.analysis,
            { ...q, atMs: Math.min(q.atMs, e.durationMs) },
            AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]),
            (phase) => send({ type: "progress", revision: q.revision, phase }),
          ),
        );
        await writeFile(
          taskPath,
          JSON.stringify({
            status: controller.signal.aborted ? "superseded" : "completed",
            ...result,
          }),
        );
        if (stream) {
          send({ type: "result", result });
          stream.end();
          return reply;
        }
        return result;
      } catch (error) {
        await writeFile(
          taskPath,
          JSON.stringify({
            status: controller.signal.aborted ? "superseded" : "failed",
            revision: q.revision,
          }),
        );
        if (stream) {
          send({
            type: "error",
            error: error instanceof Error ? error.message : "Question failed",
          });
          stream.end();
          return reply;
        }
        throw error;
      } finally {
        reply.raw.off("close", onClose);
      }
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/episodes/:id/transcribe-question",
    async (req, reply) => {
      get(req.params.id);
      if (!services)
        return reply.code(503).send({ error: "服务端未配置 OpenAI API key" });
      const file = await req.file({
        limits: { fileSize: 12 * 1024 * 1024, files: 1 },
      });
      if (!file) throw Error("缺少问题录音");
      const bytes = await file.toBuffer();
      if (
        bytes.length < 44 ||
        bytes.toString("ascii", 0, 4) !== "RIFF" ||
        bytes.toString("ascii", 8, 12) !== "WAVE"
      )
        throw Error("问题录音必须为 WAV");
      const abort = new AbortController();
      const onClose = () => {
        if (!reply.raw.writableEnded) abort.abort();
      };
      reply.raw.on("close", onClose);
      try {
        return {
          text: await services.voice.transcribeQuestion(
            bytes,
            AbortSignal.any([abort.signal, AbortSignal.timeout(30000)]),
          ),
        };
      } finally {
        reply.raw.off("close", onClose);
      }
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/episodes/:id/live",
    async (req, reply) => {
      const e = get(req.params.id);
      if (!e.analysis) throw Error("节目尚未完成分析");
      if (!services)
        return reply.code(503).send({ error: "服务端未配置 OpenAI API key" });
      const q = liveSchema.parse(req.body);
      const result = await services.voice.createLive(
        q.sdp,
        e.analysis,
        q.atMs,
        q.history,
      );
      store.recordUsage(e.id, result.session.id, 0, false);
      return result;
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/episodes/:id/usage",
    async (req) => {
      get(req.params.id);
      const data = z
        .object({
          sessionId: z.string().min(1).max(200),
          seconds: z.number().nonnegative(),
          finalized: z.boolean(),
        })
        .parse(req.body);
      store.recordUsage(
        req.params.id,
        data.sessionId,
        data.seconds,
        data.finalized,
      );
      return { ok: true };
    },
  );
  app.get<{ Params: { id: string } }>(
    "/api/episodes/:id/usage",
    async (req) => {
      get(req.params.id);
      return store.usage(req.params.id);
    },
  );
  app.addHook("onReady", async () => jobs.start());
  return app;
}
