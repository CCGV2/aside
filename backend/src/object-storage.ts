import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
export interface ObjectStorage {
  head(key: string): { size: number } | undefined;
  put(
    key: string,
    source: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
    limit?: number,
  ): Promise<void>;
  read(key: string, start?: number, end?: number): AsyncIterable<Uint8Array>;
  delete(key: string): void;
}
/** Chunked SQLite objects keep upload and Range reads bounded in memory. */
export class SqliteObjects implements ObjectStorage {
  private readers = new Map<string, number>();
  private collect(key: string) {
    const active = [...this.readers.keys()];
    this.db
      .prepare(
        `DELETE FROM object_parts WHERE key=? AND version NOT IN (SELECT version FROM objects WHERE key=?)${active.length ? ` AND version NOT IN (${active.map(() => "?").join(",")})` : ""}`,
      )
      .run(key, key, ...active);
  }
  constructor(private db: DatabaseSync) {
    db.exec(`CREATE TABLE IF NOT EXISTS objects(key TEXT PRIMARY KEY,version TEXT NOT NULL,size INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS object_parts(key TEXT NOT NULL,version TEXT NOT NULL,part INTEGER NOT NULL,offset INTEGER NOT NULL,data BLOB NOT NULL,PRIMARY KEY(key,version,part));`);
  }
  head(key: string) {
    return this.db.prepare("SELECT size FROM objects WHERE key=?").get(key) as
      { size: number } | undefined;
  }
  async put(
    key: string,
    source: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
    limit = 500 * 1024 * 1024,
  ) {
    const version = randomUUID();
    let size = 0,
      part = 0;
    const insert = this.db.prepare(
      "INSERT INTO object_parts VALUES(?,?,?,?,?)",
    );
    try {
      for await (const bytes of source) {
        if (size + bytes.byteLength > limit)
          throw Error("音频超过存储大小限制");
        for (let at = 0; at < bytes.byteLength; at += 262144) {
          const chunk = bytes.subarray(at, at + 262144);
          insert.run(key, version, part++, size, chunk);
          size += chunk.byteLength;
        }
      }
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db
          .prepare(
            "INSERT INTO objects VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET version=excluded.version,size=excluded.size",
          )
          .run(key, version, size);
        this.collect(key);
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    } catch (error) {
      this.db
        .prepare("DELETE FROM object_parts WHERE key=? AND version=?")
        .run(key, version);
      throw error;
    }
  }
  async *read(key: string, start = 0, end?: number) {
    const object = this.db
      .prepare("SELECT version,size FROM objects WHERE key=?")
      .get(key) as { version: string; size: number } | undefined;
    if (!object) throw Error("音频不存在");
    const stop =
      end === undefined ? object.size : Math.min(end + 1, object.size);
    this.readers.set(
      object.version,
      (this.readers.get(object.version) ?? 0) + 1,
    );
    try {
      const rows = this.db
        .prepare(
          "SELECT offset,data FROM object_parts WHERE key=? AND version=? AND offset<? AND offset+length(data)>? ORDER BY part",
        )
        .iterate(key, object.version, stop, start);
      for (const row of rows) {
        const offset = Number(row.offset),
          data = row.data as Uint8Array;
        yield data.subarray(
          Math.max(0, start - offset),
          Math.min(data.byteLength, stop - offset),
        );
      }
    } finally {
      const remaining = this.readers.get(object.version)! - 1;
      if (remaining) this.readers.set(object.version, remaining);
      else this.readers.delete(object.version);
      this.collect(key);
    }
  }
  delete(key: string) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("DELETE FROM objects WHERE key=?").run(key);
      this.collect(key);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}
