import { test } from "node:test";
import assert from "node:assert/strict";
import type { Episode } from "@aside/engine/core";
import {
  byLocale,
  languageBadge,
  libraryFor,
  visibleForLocale,
} from "../frontend/src/library-item";

function episode(
  id: string,
  language?: string,
  languageVisibility?: string[],
): Episode {
  return {
    id,
    title: id,
    createdAt: "2026-01-01T00:00:00.000Z",
    durationMs: 60_000,
    status: "ready",
    stage: "",
    progress: 1,
    ...(language
      ? {
          attribution: {
            publisher: "publisher",
            author: "author",
            sourceUrl: "https://example.test/source",
            licenseUrl: "https://example.test/license",
            license: "license",
            language,
            ...(languageVisibility ? { languageVisibility } : {}),
            excerptStartMs: 0,
            excerptEndMs: 60_000,
          },
        }
      : {}),
  };
}

test("episodes in the interface language come first without reordering the rest", () => {
  const list = [
    episode("a", "en"),
    episode("b", "zh"),
    episode("c", "en"),
    episode("d", "zh"),
  ];
  assert.deepEqual(
    byLocale(list, "zh").map((item) => item.id),
    ["b", "d", "a", "c"],
  );
  assert.deepEqual(
    byLocale(list, "en").map((item) => item.id),
    ["a", "c", "b", "d"],
  );
});

test("episodes without a language stay behind the matching ones in arrival order", () => {
  const list = [episode("a"), episode("b", "zh"), episode("c")];
  assert.deepEqual(
    byLocale(list, "zh").map((item) => item.id),
    ["b", "a", "c"],
  );
});

test("a badge names only the recordings in another language", () => {
  assert.equal(languageBadge(episode("a", "en"), "en"), undefined);
  assert.equal(languageBadge(episode("a", "zh"), "zh"), undefined);
  assert.equal(languageBadge(episode("a"), "en"), undefined);
  assert.equal(languageBadge(episode("a", "en"), "zh"), "英文");
  assert.equal(languageBadge(episode("a", "zh"), "en"), "Chinese");
  assert.equal(languageBadge(episode("a", "fr"), "en"), "fr");
});

test("region and script tags fall back to their primary subtag", () => {
  const list = [episode("a", "en-US"), episode("b", "zh-Hans-CN")];
  assert.deepEqual(
    byLocale(list, "zh").map((item) => item.id),
    ["b", "a"],
  );
  assert.equal(languageBadge(episode("a", "zh-Hant"), "zh"), undefined);
  assert.equal(languageBadge(episode("b", "en-GB"), "zh"), "英文");
});

test("languageVisibility decides which pages publish a recording", () => {
  assert.equal(visibleForLocale(episode("a", "en", ["en"]), "zh"), false);
  assert.equal(visibleForLocale(episode("a", "en", ["en"]), "en"), true);
  assert.equal(
    visibleForLocale(episode("a", "en", ["en", "zh-cn"]), "zh"),
    true,
  );
  assert.equal(visibleForLocale(episode("a", "en", ["zh-cn"]), "zh"), true);
  assert.equal(visibleForLocale(episode("a", "en", ["zh-Hans"]), "zh"), true);
});

test("a recording without languageVisibility stays visible everywhere", () => {
  assert.equal(visibleForLocale(episode("a", "en"), "zh"), true);
  assert.equal(visibleForLocale(episode("a"), "zh"), true);
  assert.equal(visibleForLocale(episode("a", "en", []), "zh"), true);
});

test("libraryFor filters by page and then orders by language", () => {
  const list = [
    episode("en-only", "en", ["en"]),
    episode("both-late", "en", ["en", "zh-cn"]),
    episode("zh-only", "zh", ["zh-cn"]),
    episode("own-upload"),
  ];
  assert.deepEqual(
    libraryFor(list, "zh").map((item) => item.id),
    ["zh-only", "both-late", "own-upload"],
  );
  assert.deepEqual(
    libraryFor(list, "en").map((item) => item.id),
    ["en-only", "both-late", "own-upload"],
  );
});

test("a malformed visibility value is treated as no list rather than crashing", () => {
  const base = episode("a", "en");
  const broken = {
    ...base,
    attribution: { ...base.attribution, languageVisibility: "en" },
  } as unknown as Episode;
  assert.equal(visibleForLocale(broken, "zh"), true);
  assert.equal(visibleForLocale(broken, "en"), true);
});

test("ordering returns a new list and leaves the caller's array alone", () => {
  const list = [episode("a", "en"), episode("b", "zh")];
  const ordered = byLocale(list, "zh");
  assert.notEqual(ordered, list);
  assert.deepEqual(
    list.map((item) => item.id),
    ["a", "b"],
  );
  assert.deepEqual(
    ordered.map((item) => item.id),
    ["b", "a"],
  );
});
