import { Records } from "./records.js";
import type { Episode, Analysis } from "@aside/engine/core";
import { HttpError } from "./http.js";
export interface EpisodeRow {
  id: string;
  owner_id: string;
  public: number;
  metadata: string;
  analysis_key: string | null;
  workflow_id: string | null;
  deleted_at: number | null;
}
export class CloudStore {
  readonly records: Records;
  constructor(
    readonly db: D1Database,
    readonly bucket: R2Bucket,
  ) {
    this.records = new Records(db);
  }
  async list(owner: string) {
    const { results } = await this.db
      .prepare(
        "SELECT metadata FROM episodes WHERE deleted_at IS NULL AND (owner_id=? OR public=1) ORDER BY created_at DESC LIMIT 100",
      )
      .bind(owner)
      .all<{ metadata: string }>();
    return results.map((row) => JSON.parse(row.metadata) as Episode);
  }
  async row(id: string, owner?: string) {
    const row = await this.db
      .prepare("SELECT * FROM episodes WHERE id=?")
      .bind(id)
      .first<EpisodeRow>();
    if (!row || row.deleted_at !== null || (owner !== undefined && row.owner_id !== owner && !row.public))
      throw new HttpError(404, "节目不存在");
    return row;
  }
  async episode(row: EpisodeRow): Promise<Episode> {
    const episode = JSON.parse(row.metadata) as Episode;
    if (row.analysis_key) {
      const analysis = await this.records.get<Analysis>(row.analysis_key);
      if (!analysis) throw new HttpError(503, "分析结果暂不可用");
      episode.analysis = analysis;
    }
    return episode;
  }
  async create(owner: string, episode: Episode) {
    await this.db
      .prepare(
        "INSERT INTO episodes(id,owner_id,metadata,created_at) VALUES(?,?,?,?)",
      )
      .bind(episode.id, owner, JSON.stringify(episode), episode.createdAt)
      .run();
  }
  async update(episode: Episode, analysisKey?: string) {
    const { analysis, ...metadata } = episode;
    const result = await this.db
      .prepare(
        "UPDATE episodes SET metadata=?,analysis_key=COALESCE(?,analysis_key) WHERE id=? AND deleted_at IS NULL",
      )
      .bind(JSON.stringify(metadata), analysisKey ?? null, episode.id)
      .run();
    if (!result.meta.changes) throw new HttpError(404, "节目不存在");
  }
  /** Atomic reservation. Failed calls also consume quota; no client-reported refunds. */
  async reserve(bucket: string, limit: number) {
    const result = await this.db
      .prepare(
        `INSERT INTO budgets(bucket,used) VALUES(?,1)
      ON CONFLICT(bucket) DO UPDATE SET used=used+1 WHERE used < ? RETURNING used`,
      )
      .bind(bucket, limit)
      .first();
    if (!result) throw new HttpError(429, "今日体验额度已用完，请明天再试");
  }
}
export function positiveLimit(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1)
    throw new HttpError(503, "服务端额度配置无效");
  return n;
}
