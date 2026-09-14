import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUDIO_HOSTS,
  validateSpec,
  type SampleSpec,
} from "../scripts/sample-spec";

function spec(overrides: Partial<SampleSpec> = {}): SampleSpec {
  return {
    id: "sample-one",
    sourceId: "source-one",
    title: "Title",
    publisher: "Publisher",
    author: "Author",
    sourceUrl: "https://example.test/source",
    audioUrl: `https://${AUDIO_HOSTS[0]}/download/source-one.mp3`,
    license: "Public domain",
    licenseUrl: "https://example.test/license",
    summary: "Summary",
    sourceSha256: "0".repeat(64),
    excerptStartMs: 0,
    excerptEndMs: 1000,
    ...overrides,
  };
}

test("a fully credited spec on an approved host passes", () => {
  for (const host of AUDIO_HOSTS)
    assert.doesNotThrow(() =>
      validateSpec(spec({ audioUrl: `https://${host}/x.mp3` })),
    );
});

test("every credit is required, and the error names the missing ones", () => {
  for (const field of [
    "title",
    "publisher",
    "author",
    "sourceUrl",
    "license",
    "licenseUrl",
    "summary",
    "sourceSha256",
  ] as const) {
    const blank = { ...spec(), [field]: "" };
    assert.throws(
      () => validateSpec(blank),
      new RegExp(field),
      `${field} should be required`,
    );
  }
});

test("whitespace does not count as a credit", () => {
  assert.throws(
    () => validateSpec(spec({ publisher: "   ", license: "\t" })),
    /publisher, license/,
  );
});

test("only https on an approved host is downloaded", () => {
  for (const audioUrl of [
    "https://example.test/x.mp3",
    "https://voa-audio.voanews.eu/x.mp3",
    `http://${AUDIO_HOSTS[0]}/x.mp3`,
    `ftp://${AUDIO_HOSTS[0]}/x.mp3`,
  ])
    assert.throws(
      () => validateSpec(spec({ audioUrl })),
      /unapproved audio host/,
      audioUrl,
    );
});

test("a malformed url names the spec instead of throwing a bare TypeError", () => {
  assert.throws(() => validateSpec(spec({ audioUrl: "not a url" })), {
    message: /sample-one: invalid audioUrl/,
  });
});

test("an empty visibility list is rejected, an omitted one is not", () => {
  assert.throws(
    () => validateSpec(spec({ languageVisibility: [] })),
    /languageVisibility is empty/,
  );
  assert.doesNotThrow(() =>
    validateSpec(spec({ languageVisibility: ["en", "zh-cn"] })),
  );
});

test("ids and source ids that cannot be published are rejected", () => {
  assert.throws(
    () => validateSpec(spec({ id: "Upper-Case" })),
    /Invalid sample id/,
  );
  assert.throws(
    () => validateSpec(spec({ sourceId: "has.dots" })),
    /invalid sourceId/,
  );
});
