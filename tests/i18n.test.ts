import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveLocale } from "../frontend/src/i18n";

test("locale follows ordered browser preferences with English fallback", () => {
  assert.equal(resolveLocale(["en-US", "zh-CN"]), "en");
  assert.equal(resolveLocale(["zh-TW", "en-US"]), "zh");
  assert.equal(resolveLocale(["zh-Hans-CN"]), "zh");
  assert.equal(resolveLocale(["fr-FR", "zh-CN"]), "zh");
  assert.equal(resolveLocale(["fr-FR"]), "en");
  assert.equal(resolveLocale([]), "en");
});

test("saved supported language overrides the browser; invalid preference is ignored", () => {
  assert.equal(resolveLocale(["en-US"], "zh"), "zh");
  assert.equal(resolveLocale(["zh-CN"], "en"), "en");
  assert.equal(resolveLocale(["zh-CN"], "fr"), "zh");
});
