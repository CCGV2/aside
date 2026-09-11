import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Episode } from "@aside/engine/core";
export class Store {
  readonly db: DatabaseSync;
  constructor(readonly root: string) {
    mkdirSync(root, { recursive: true });
    this.db = new DatabaseSync(resolve(root, "aside.sqlite"));
    this.db.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS episodes(id TEXT PRIMARY KEY, json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS checkpoints(id TEXT PRIMARY KEY, json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS voice_usage(id TEXT PRIMARY KEY, episode_id TEXT NOT NULL, seconds REAL NOT NULL, finalized INTEGER NOT NULL);",
    );
  }
  list(): Episode[] {
    return this.db
      .prepare("SELECT json FROM episodes ORDER BY rowid DESC")
      .all()
      .map((r) => JSON.parse(String(r.json)));
  }
  get(id: string): Episode | undefined {
    const r = this.db.prepare("SELECT json FROM episodes WHERE id=?").get(id);
    return r ? JSON.parse(String(r.json)) : undefined;
  }
  put(e: Episode) {
    this.db
      .prepare(
        "INSERT INTO episodes VALUES(?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json",
      )
      .run(e.id, JSON.stringify(e));
  }
  checkpoint(id: string, value?: unknown) {
    if (value !== undefined)
      this.db
        .prepare(
          "INSERT INTO checkpoints VALUES(?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json",
        )
        .run(id, JSON.stringify(value));
    const row = this.db
      .prepare("SELECT json FROM checkpoints WHERE id=?")
      .get(id);
    return row ? JSON.parse(String(row.json)) : null;
  }
  recordUsage(
    episodeId: string,
    sessionId: string,
    seconds: number,
    finalized: boolean,
  ) {
    this.db
      .prepare(
        "INSERT INTO voice_usage VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET seconds=MAX(voice_usage.seconds,excluded.seconds),finalized=MAX(voice_usage.finalized,excluded.finalized)",
      )
      .run(sessionId, episodeId, seconds, finalized ? 1 : 0);
  }
  usage(episodeId: string) {
    return this.db
      .prepare(
        "SELECT id as sessionId,seconds,finalized FROM voice_usage WHERE episode_id=? ORDER BY rowid",
      )
      .all(episodeId);
  }
  dir(id: string) {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) throw Error("Invalid episode ID");
    return resolve(this.root, id);
  }
  close() {
    this.db.close();
  }
}
