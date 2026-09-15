import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ObjectStorage } from "./object-storage.js";
import { findSilences } from "./media.js";
const exec = promisify(execFile);
export async function probeAudio(path: string) {
  const { stdout } = await exec("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration,format_name:stream=codec_type",
    "-of",
    "json",
    path,
  ]);
  const metadata = JSON.parse(stdout);
  if (
    !metadata.streams?.some(
      (s: { codec_type: string }) => s.codec_type === "audio",
    )
  )
    throw Error("文件中没有音轨");
  const duration = Number(metadata.format.duration);
  if (!Number.isFinite(duration) || duration <= 0)
    throw Error("无法读取有效音频时长");
  const format = String(metadata.format.format_name);
  const mimeType = format.includes("mp3")
    ? "audio/mpeg"
    : format.includes("wav")
      ? "audio/wav"
      : format.includes("ogg")
        ? "audio/ogg"
        : format.includes("flac")
          ? "audio/flac"
          : format.includes("webm")
            ? "audio/webm"
            : format.includes("mov") || format.includes("mp4")
              ? "audio/mp4"
              : "application/octet-stream";
  return { durationMs: Math.round(duration * 1000), mimeType };
}
export async function probe(path: string) {
  return (await probeAudio(path)).durationMs;
}
/**
 * Writes the file's embedded artwork (ID3 APIC, MP4 covr, FLAC PICTURE) as a
 * JPEG no larger than 600px. Artwork is decorative: any failure means no cover.
 */
export async function extractCover(path: string, output: string) {
  try {
    const { stdout } = await exec("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v",
      "-show_entries",
      "stream=index:stream_disposition=attached_pic",
      "-of",
      "json",
      path,
    ]);
    // A real video track is not artwork; only attached pictures count.
    const stream = (JSON.parse(stdout).streams ?? []).find(
      (s: { disposition?: { attached_pic?: number } }) =>
        s.disposition?.attached_pic === 1,
    );
    if (!stream) return false;
    await exec(
      "ffmpeg",
      [
        "-y",
        "-v",
        "error",
        "-i",
        path,
        "-map",
        `0:${stream.index}`,
        "-frames:v",
        "1",
        "-update",
        "1",
        // Re-encoding bounds the size and never serves uploaded image bytes as-is.
        "-vf",
        "scale=w=min(600\\,iw):h=min(600\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2",
        "-c:v",
        "mjpeg",
        "-q:v",
        "3",
        "-f",
        "image2",
        output,
      ],
      { timeout: 60000 },
    );
    return true;
  } catch {
    return false;
  }
}

export async function withMedia<T>(
  objects: ObjectStorage,
  key: string,
  run: (media: {
    probe: () => ReturnType<typeof probeAudio>;
    silences: () => ReturnType<typeof findSilences>;
    chunk: (offsetMs: number, durationMs: number) => Promise<Uint8Array>;
    cover: () => Promise<Uint8Array | undefined>;
  }) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "aside-media-")),
    source = join(dir, "original");
  try {
    await pipeline(Readable.from(objects.read(key)), createWriteStream(source));
    return await run({
      probe: () => probeAudio(source),
      silences: () => findSilences(source),
      chunk: async (offsetMs, durationMs) => {
        const output = join(dir, "chunk.mp3");
        await exec(
          "ffmpeg",
          [
            "-y",
            "-v",
            "error",
            "-ss",
            String(offsetMs / 1000),
            "-i",
            source,
            "-t",
            String(durationMs / 1000),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "24000",
            "-b:a",
            "48k",
            output,
          ],
          { timeout: 120000 },
        );
        return new Uint8Array(await readFile(output));
      },
      cover: async () => {
        const output = join(dir, "cover.jpg");
        return (await extractCover(source, output))
          ? new Uint8Array(await readFile(output))
          : undefined;
      },
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
