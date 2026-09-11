import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../backend/src/store.js";
import { Jobs } from "../backend/src/jobs.js";
import { planChunks } from "../backend/src/media.js";
import type { AnalysisPort } from "@aside/engine/server";
test("chunk boundaries prefer silence while covering every millisecond", () => {
  const p = planChunks(600000, [{ startMs: 235000, endMs: 237000 }]);
  assert.equal(p[0].durationMs, 236000);
  assert.equal(
    p.reduce((n, c) => n + c.durationMs, 0),
    600000,
  );
  for (let i = 1; i < p.length; i++)
    assert.equal(p[i].offsetMs, p[i - 1].offsetMs + p[i - 1].durationMs);
});
test("analysis retry reuses completed transcript and survives storage reopen", async () => {
  const root = await mkdtemp(join(tmpdir(), "aside-jobs-"));
  const store = new Store(root);
  await mkdir(store.dir("fixture"));
  const wav = Buffer.alloc(44 + 48000);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(24000, 24);
  wav.writeUInt32LE(48000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(48000, 40);
  await writeFile(join(store.dir("fixture"), "original"), wav);
  store.put({
    id: "fixture",
    title: "test",
    createdAt: "now",
    durationMs: 1000,
    status: "queued",
    stage: "queued",
    progress: 0,
  });
  let transcriptions = 0,
    enrichments = 0;
  const port: AnalysisPort = {
    async transcribe() {
      transcriptions++;
      return [
        { id: "p", startMs: 0, endMs: 1000, text: "测试", speaker: "unknown" },
      ];
    },
    async enrich() {
      enrichments++;
      if (enrichments === 1) throw Error("temporary provider failure");
      return {
        summary: "test",
        hostStyle: "plain",
        speakers: [],
        groups: [{ firstId: "p", lastId: "p" }],
      };
    },
  };
  try {
    await new Jobs(store, port).drain();
    assert.equal(store.get("fixture")?.status, "failed");
    const e = store.get("fixture")!;
    store.put({ ...e, status: "queued" });
    await new Jobs(store, port).drain();
    assert.equal(store.get("fixture")?.status, "ready");
    assert.equal(transcriptions, 1);
    assert.equal(enrichments, 2);
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});
