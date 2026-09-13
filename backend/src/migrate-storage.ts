import { readdir, readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import type { Store } from "./store.js";
/** Explicit, idempotent import. Runtime never falls back to legacy files. */
export async function migrateStorage(store: Store, root: string) {
  let originals = 0,
    artifacts = 0,
    bytes = 0;
  for (const episode of store.list()) {
    if (!/^[a-zA-Z0-9-]+$/.test(episode.id))
      throw Error("Invalid legacy episode id");
    const dir = resolve(root, episode.id);
    let files: string[];
    try {
      files = await readdir(dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    const key = `episodes/${episode.id}/original`;
    if (files.includes("original") && !store.objects.head(key)) {
      const expected = createHash("sha256");
      async function* source() {
        for await (const part of createReadStream(join(dir, "original"))) {
          expected.update(part);
          yield part;
        }
      }
      await store.objects.put(key, source());
      const actual = createHash("sha256");
      for await (const part of store.objects.read(key)) actual.update(part);
      if (expected.digest("hex") !== actual.digest("hex")) {
        store.objects.delete(key);
        throw Error("Migrated audio verification failed");
      }
      originals++;
      bytes += store.objects.head(key)!.size;
    }
    for (const file of files) {
      if (
        !/^(?:transcript-v1-\d+|analysis-v1-\d+|silences-v1|question-[a-f0-9-]+|.+\.enrichment-[a-f0-9-]+)\.json$/.test(
          file,
        )
      )
        continue;
      const name = file.slice(0, -5);
      if (store.artifact(episode.id, name) !== undefined) continue;
      const raw = await readFile(join(dir, file), "utf8");
      const value = file.includes(".enrichment-") ? raw : JSON.parse(raw);
      store.saveArtifact(episode.id, name, value);
      if (
        JSON.stringify(store.artifact(episode.id, name)) !==
        JSON.stringify(value)
      )
        throw Error("Migrated record verification failed");
      artifacts++;
    }
  }
  return { originals, artifacts, bytes };
}
