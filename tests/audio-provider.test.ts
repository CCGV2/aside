import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { AudioProvider } from "../backend/src/audio-provider.js";

async function bodyFor(
  t: TestContext,
  prompt?: string,
): Promise<Record<string, unknown>> {
  const provider = new AudioProvider("test-placeholder");
  const bodies: Record<string, unknown>[] = [];
  t.mock.method(
    provider.client.audio.transcriptions,
    "create",
    async (body: Record<string, unknown>) => {
      bodies.push(body);
      return { segments: [], words: [] };
    },
  );
  await provider.transcribeAudio(new Uint8Array([0]), 0, prompt);
  return bodies[0];
}

test("the steering prompt is optional, trimmed and bounded", async (t) => {
  assert.equal("prompt" in (await bodyFor(t)), false);
  assert.equal("prompt" in (await bodyFor(t, "   ")), false);
  assert.equal(
    (await bodyFor(t, "  这是一段带标点的中文朗读。  "))["prompt"],
    "这是一段带标点的中文朗读。",
  );
  assert.equal(
    (await bodyFor(t, "甲".repeat(400)))["prompt"],
    "甲".repeat(120),
  );
});
