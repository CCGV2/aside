import { writeFile } from "node:fs/promises";
import type { Episode } from "@aside/engine/core";

const quote = (value: string) => "'" + value.replace(/'/g, "''") + "'";

/**
 * Writes the D1 seed for one published sample: the analysis artifact, split
 * into statement-sized chunks, plus the episode row. D1 caps a single
 * statement well below the size of a full transcript, and the split is by
 * UTF-8 byte budget so multi-byte transcripts are not cut mid-character.
 * Returns the artifact key the episode row points at.
 */
export async function writeSeedSql(directory: string, episode: Episode) {
  const { analysis, ...metadata } = episode;
  const key = `episodes/${episode.id}/analysis-v1/complete.json`;
  const json = JSON.stringify(analysis);
  const sql = [`DELETE FROM artifacts WHERE key=${quote(key)};`];
  let chunk = "",
    part = 0;
  const flush = () => {
    sql.push(
      `INSERT INTO artifacts(key,part,value) VALUES(${quote(key)},${part++},${quote(chunk)});`,
    );
    chunk = "";
  };
  for (const char of json) {
    if (Buffer.byteLength(chunk + char) > 45000) flush();
    chunk += char;
  }
  if (chunk) flush();
  sql.push(
    `INSERT INTO episodes(id,owner_id,public,metadata,analysis_key,created_at) VALUES(${quote(episode.id)},'official',1,${quote(JSON.stringify(metadata))},${quote(key)},${quote(metadata.createdAt)}) ON CONFLICT(id) DO UPDATE SET metadata=excluded.metadata,analysis_key=excluded.analysis_key,public=1;`,
  );
  await writeFile(`${directory}/${episode.id}.sql`, sql.join("\n") + "\n");
  return key;
}
