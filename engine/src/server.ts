import {
  selectVoice,
  type Analysis,
  type Passage,
  type Turn,
  type Speaker,
} from "./core.js";
export interface AnalysisPort {
  transcribe(path: string, offsetMs: number): Promise<Passage[]>;
  enrich(
    path: string,
    passages: Passage[],
  ): Promise<{
    summary: string;
    hostStyle: string;
    speakers: Speaker[];
    groups: { firstId: string; lastId: string }[];
  }>;
}
export function makeAnalysis(
  passages: Passage[],
  info: Awaited<ReturnType<AnalysisPort["enrich"]>>,
): Analysis {
  const sorted = [...passages].sort((a, b) => a.startMs - b.startMs);
  const covered = new Set<string>();
  const anchors = info.groups.flatMap((g, i) => {
    const start = sorted.findIndex((p) => p.id === g.firstId),
      end = sorted.findIndex((p) => p.id === g.lastId);
    if (
      start < 0 ||
      end < start ||
      sorted.slice(start, end + 1).some((p) => covered.has(p.id))
    )
      return [];
    const ps = sorted.slice(start, end + 1);
    ps.forEach((p) => covered.add(p.id));
    return [
      {
        id: `a-${i}`,
        startMs: Math.max(0, ps[0].startMs - 100),
        endMs: ps.at(-1)!.endMs,
        text: ps.map((p) => p.text).join(""),
        confidence: 0.75,
      },
    ];
  });
  for (const p of sorted)
    if (!covered.has(p.id))
      anchors.push({
        id: `a-${p.id}`,
        startMs: Math.max(0, p.startMs - 100),
        endMs: p.endMs,
        text: p.text,
        confidence: 0.5,
      });
  const picked = selectVoice(info.speakers);
  return {
    version: crypto.randomUUID(),
    passages: sorted,
    anchors: anchors.sort((a, b) => a.startMs - b.startMs),
    ...info,
    voice: picked.voice,
    voiceReason: picked.reason,
    source: "provider",
  };
}
export function getPassage(a: Analysis, atMs: number, heardUntilMs: number) {
  return a.passages
    .filter((p) => p.endMs >= atMs - 30000 && p.startMs <= atMs + 15000)
    .filter((p) => p.endMs <= heardUntilMs);
}
const terms = (s: string) => {
  const t = s.toLowerCase();
  return [
    ...new Set([
      ...(t.match(/[a-z0-9]{2,}/g) ?? []),
      ...(t.match(/[\u3400-\u9fff]{2,}/g) ?? []).flatMap((w) =>
        Array.from({ length: w.length - 1 }, (_, i) => w.slice(i, i + 2)),
      ),
    ]),
  ];
};
export function searchPodcast(
  a: Analysis,
  query: string,
  heardUntilMs: number,
) {
  const ts = terms(query);
  return a.passages
    .filter((p) => p.endMs <= heardUntilMs)
    .map((p) => ({
      ...p,
      score: ts.reduce(
        (n, t) => n + (p.text.toLowerCase().includes(t) ? 1 : 0),
        0,
      ),
    }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}
export function buildContext(a: Analysis, atMs: number, history: Turn[]) {
  return {
    playheadMs: atMs,
    currentPassage: a.passages.find((p) => p.startMs <= atMs && p.endMs > atMs)
      ? {
          ...a.passages.find((p) => p.startMs <= atMs && p.endMs > atMs)!,
          partiallyHeard: true,
        }
      : null,
    recentTranscript: a.passages.filter(
      (p) => p.startMs >= atMs - 120000 && p.endMs <= atMs,
    ),
    earlierExcerpts: a.passages
      .filter((p) => p.endMs <= atMs - 120000)
      .filter((_, i, all) => i % Math.max(1, Math.ceil(all.length / 12)) === 0)
      .slice(-12),
    hostStyle: a.hostStyle,
    history: history.slice(-20),
  };
}

/** Byte budget is a conservative upper bound on tokenizer tokens for startup history. */
export function liveStartupHistory(history: Turn[], maxBytes = 6000): Turn[] {
  const encoder = new TextEncoder();
  let budget = maxBytes;
  const selected: Turn[] = [];
  for (const turn of history.slice(-12).reverse()) {
    let text = "";
    for (const char of turn.text) {
      const bytes = encoder.encode(char).length;
      if (bytes > budget) break;
      text += char;
      budget -= bytes;
    }
    if (text) selected.unshift({ role: turn.role, text });
    if (budget < 4) break;
  }
  return selected;
}
