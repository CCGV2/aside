import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../backend/src/store.js";
import { migrateStorage } from "../backend/src/migrate-storage.js";
import { createApp } from "../backend/src/app.js";
async function bytes(source: AsyncIterable<Uint8Array>) {
  const all = [];
  for await (const part of source) all.push(Buffer.from(part));
  return Buffer.concat(all);
}
test("SQLite objects stream ranges across chunks and failed replacement preserves committed bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "aside-objects-"));
  const store = new Store(root);
  try {
    const data = Buffer.alloc(800000);
    for (let i = 0; i < data.length; i++) data[i] = i % 251;
    await store.objects.put("audio", [data]);
    assert.deepEqual(
      await bytes(store.objects.read("audio", 260000, 530000)),
      data.subarray(260000, 530001),
    );
    async function* broken() {
      yield Buffer.from("partial");
      throw Error("upload disconnected");
    }
    await assert.rejects(store.objects.put("audio", broken()));
    assert.deepEqual(await bytes(store.objects.read("audio")), data);
    assert.equal(store.objects.head("audio")?.size, data.length);
    const reader = store.objects.read("audio")[Symbol.asyncIterator]();
    const first = await reader.next();
    await store.objects.put("audio", [Buffer.from("new audio")]);
    const rest = [];
    for (;;) {
      const next = await reader.next();
      if (next.done) break;
      rest.push(Buffer.from(next.value));
    }
    assert.deepEqual(Buffer.concat([Buffer.from(first.value!), ...rest]), data);
    assert.deepEqual(
      await bytes(store.objects.read("audio")),
      Buffer.from("new audio"),
    );
    assert.equal(
      store.db
        .prepare("SELECT COUNT(DISTINCT version) AS n FROM object_parts")
        .get()!.n,
      1,
    );
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});
test("legacy migration is idempotent and playback/transcript survive deleting legacy directories and reopening DB", async () => {
  const root = await mkdtemp(join(tmpdir(), "aside-migrate-"));
  let store = new Store(root);
  const e = {
    id: "legacy",
    title: "Imported",
    createdAt: "now",
    durationMs: 1000,
    status: "ready" as const,
    stage: "ready",
    progress: 1,
  };
  try {
    store.put(e);
    await mkdir(join(root, e.id));
    await writeFile(join(root, e.id, "original"), Buffer.from("0123456789"));
    const transcript = [{ id: "p", startMs: 0, endMs: 1000, text: "中文😀" }];
    await writeFile(
      join(root, e.id, "transcript-v1-0.json"),
      JSON.stringify(transcript),
    );
    await writeFile(
      join(root, e.id, "question-abcdef.json"),
      JSON.stringify({ status: "completed" }),
    );
    assert.deepEqual(await migrateStorage(store, root), {
      originals: 1,
      artifacts: 2,
      bytes: 10,
    });
    assert.deepEqual(await migrateStorage(store, root), {
      originals: 0,
      artifacts: 0,
      bytes: 0,
    });
    store.close();
    await rm(join(root, e.id), { recursive: true });
    store = new Store(root);
    assert.deepEqual(store.artifact(e.id, "transcript-v1-0"), transcript);
    assert.deepEqual(store.artifact(e.id, "question-abcdef"), {
      status: "completed",
    });
    const app = createApp(store);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/episodes/legacy/audio",
        headers: { range: "bytes=2-5" },
      });
      assert.equal(response.statusCode, 206);
      assert.equal(response.body, "2345");
    } finally {
      await app.close();
    }
    assert.ok(
      (await readdir(root)).every((name) => name.startsWith("aside.sqlite")),
    );
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});
