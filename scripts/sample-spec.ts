export interface SampleSpec {
  id: string;
  sourceId: string;
  title: string;
  publisher: string;
  author: string;
  sourceUrl: string;
  audioUrl: string;
  license: string;
  licenseUrl: string;
  summary: string;
  sourceSha256: string;
  language?: string;
  languageVisibility?: string[];
  transcriptionStartMs?: number;
  transcriptionEndMs?: number;
  excerptStartMs: number;
  excerptEndMs: number;
}

/** Audio hosts the preparation run is allowed to download from. */
export const AUDIO_HOSTS = ["archive.org", "catalog.archives.gov"];

const REQUIRED_TEXT = [
  "title",
  "publisher",
  "author",
  "sourceUrl",
  "license",
  "licenseUrl",
  "summary",
  "sourceSha256",
] as const;

/**
 * Rejects a spec before anything is downloaded or sent to a paid provider.
 * Attribution is mandatory: every published sample is credited to a named
 * source under a named licence, and a fallback would quietly credit whichever
 * source that fallback happens to name.
 */
export function validateSpec(spec: SampleSpec): void {
  if (!/^[a-z][a-z0-9-]+$/.test(spec.id))
    throw Error(`Invalid sample id: ${spec.id}`);
  if (!/^[a-zA-Z0-9-]+$/.test(spec.sourceId))
    throw Error(`${spec.id}: invalid sourceId: ${spec.sourceId}`);
  let audio: URL;
  try {
    audio = new URL(spec.audioUrl);
  } catch {
    throw Error(`${spec.id}: invalid audioUrl: ${spec.audioUrl}`);
  }
  if (audio.protocol !== "https:" || !AUDIO_HOSTS.includes(audio.hostname))
    throw Error(`${spec.id}: unapproved audio host: ${spec.audioUrl}`);
  const missing = REQUIRED_TEXT.filter((field) => !spec[field]?.trim());
  if (missing.length)
    throw Error(
      `${spec.id}: attribution and credits are required: ${missing.join(", ")}`,
    );
  if (spec.languageVisibility?.length === 0)
    throw Error(
      `${spec.id}: languageVisibility is empty; omit it to publish on the recording's own language page`,
    );
}
