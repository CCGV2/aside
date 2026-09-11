import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
export async function findSilences(path: string) {
  const { stderr } = await exec(
    "ffmpeg",
    [
      "-hide_banner",
      "-i",
      path,
      "-af",
      "silencedetect=noise=-35dB:d=0.18",
      "-f",
      "null",
      "-",
    ],
    { timeout: 180000, maxBuffer: 8 * 1024 * 1024 },
  );
  const pauses: { startMs: number; endMs: number }[] = [];
  let start: number | undefined;
  for (const line of stderr.split("\n")) {
    const a = /silence_start: ([\d.]+)/.exec(line);
    if (a) start = Number(a[1]) * 1000;
    const b = /silence_end: ([\d.]+)/.exec(line);
    if (b && start !== undefined) {
      pauses.push({
        startMs: Math.round(start),
        endMs: Math.round(Number(b[1]) * 1000),
      });
      start = undefined;
    }
  }
  return pauses;
}
export function planChunks(
  durationMs: number,
  pauses: { startMs: number; endMs: number }[],
) {
  const chunks: { offsetMs: number; durationMs: number }[] = [];
  let at = 0;
  while (at < durationMs) {
    const target = Math.min(at + 240000, durationMs);
    const nearest =
      target === durationMs
        ? undefined
        : pauses
            .filter((p) => Math.abs((p.startMs + p.endMs) / 2 - target) < 15000)
            .sort(
              (a, b) =>
                Math.abs((a.startMs + a.endMs) / 2 - target) -
                Math.abs((b.startMs + b.endMs) / 2 - target),
            )[0];
    const end = nearest
      ? Math.round((nearest.startMs + nearest.endMs) / 2)
      : target;
    chunks.push({ offsetMs: at, durationMs: end - at });
    at = end;
  }
  return chunks;
}
