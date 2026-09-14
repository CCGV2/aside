import type { Passage } from "@aside/engine/core";

export interface PassageGroup {
  firstId: string;
  lastId: string;
}

/**
 * Sentence endings across the material the public library draws on: Latin
 * punctuation and the full-width marks Chinese uses, each optionally followed
 * by a closing quote. Without the full-width marks a Chinese transcript never
 * splits at a sentence, so every resume anchor would fall back to the duration
 * cap and land mid-sentence.
 */
const SENTENCE_END = /[.!?。！？…][”’"'」』）)]?$/;

/**
 * Groups adjacent transcript segments so playback resumes at a sentence start.
 * The provider's own grouping is not trusted for resume points, and a group is
 * never allowed to run past `maxMs` even when no sentence ends.
 */
export function sentenceGroups(
  passages: Passage[],
  maxMs = 25000,
): PassageGroup[] {
  const groups: PassageGroup[] = [];
  let first = 0;
  for (let index = 0; index < passages.length; index++) {
    const nextWouldBeLong =
      index + 1 < passages.length &&
      passages[index + 1].endMs - passages[first].startMs > maxMs;
    if (
      SENTENCE_END.test(passages[index].text) ||
      nextWouldBeLong ||
      index === passages.length - 1
    ) {
      groups.push({
        firstId: passages[first].id,
        lastId: passages[index].id,
      });
      first = index + 1;
    }
  }
  return groups;
}
