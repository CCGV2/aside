import { DatabaseSync } from "node:sqlite";
import { mkdir, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { resolve, join } from "node:path";
import type { Episode } from "@aside/engine/core";
// Only the project-generated demo is released; private listening history is never exported.
const id = "demo-natural-resume";
const dir = resolve(".wrangler/release-demo");
const db = new DatabaseSync(
  resolve(process.env.ASIDE_DATA_DIR || ".data", "aside.sqlite"),
  { readOnly: true },
);
try {
  const row = db.prepare("SELECT json FROM episodes WHERE id=?").get(id);
  if (!row) throw Error("Public demo missing");
  const episode = JSON.parse(String(row.json)) as Episode;
  const { analysis, ...metadata } = episode;
  if (episode.status !== "ready" || analysis?.source !== "demo")
    throw Error("Only a ready project-generated demo can be released");
  const audioKey = `episodes/${id}/original`,
    recordKey = `episodes/${id}/analysis-v1/complete.json`;
  const object = db
    .prepare("SELECT version,size FROM objects WHERE key=?")
    .get(audioKey);
  if (!object) throw Error("Demo audio missing from database");
  await mkdir(dir, { recursive: true });
  function* audio() {
    for (const part of db
      .prepare(
        "SELECT data FROM object_parts WHERE key=? AND version=? ORDER BY part",
      )
      .iterate(audioKey, String(object!.version)))
      yield part.data as Uint8Array;
  }
  await pipeline(
    Readable.from(audio()),
    createWriteStream(join(dir, "original.mp3")),
  );
  const quote = (value: string) => "'" + value.replace(/'/g, "''") + "'";
  const value = JSON.stringify(analysis);
  if (Buffer.byteLength(value) > 64000)
    throw Error("Demo analysis exceeds single-statement export limit");
  const sql = [
    `INSERT INTO artifacts(key,part,value) VALUES(${quote(recordKey)},0,${quote(value)}) ON CONFLICT(key,part) DO UPDATE SET value=excluded.value;`,
    `INSERT INTO episodes(id,owner_id,public,metadata,analysis_key,created_at) VALUES(${quote(id)},'official',1,${quote(JSON.stringify(metadata))},${quote(recordKey)},${quote(metadata.createdAt)}) ON CONFLICT(id) DO UPDATE SET public=1,metadata=excluded.metadata,analysis_key=excluded.analysis_key;`,
  ].join("\n");
  await writeFile(join(dir, "seed.sql"), sql + "\n");
  console.log(
    JSON.stringify({
      id,
      title: metadata.title,
      audioBytes: Number(object.size),
      directory: dir,
    }),
  );
} finally {
  db.close();
}
