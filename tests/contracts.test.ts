import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkpointSchema,
  questionResultSchema,
} from "@aside/engine/contracts";
import { readQuestion } from "../frontend/src/question-stream.js";
const valid = {
  revision: 2,
  action: "answer",
  answer: "解释",
  sources: [],
  tools: [],
};
test("JSON and streaming clients reject malformed answer shapes", async () => {
  for (const bad of [
    { ...valid, action: "unexpected" },
    { ...valid, revision: -1 },
    { ...valid, sources: [{ text: "missing time", startMs: -10 }] },
  ]) {
    assert.equal(questionResultSchema.safeParse(bad).success, false);
    await assert.rejects(readQuestion(Response.json(bad), () => {}));
    await assert.rejects(
      readQuestion(
        new Response(JSON.stringify({ type: "result", result: bad }), {
          headers: { "Content-Type": "application/x-ndjson" },
        }),
        () => {},
      ),
    );
  }
  assert.deepEqual(await readQuestion(Response.json(valid), () => {}), valid);
});
test("unknown progress phases fail before invoking the progress callback", async () => {
  let callbacks = 0;
  await assert.rejects(
    readQuestion(
      new Response('{"type":"progress","revision":2,"phase":"invented"}\n', {
        headers: { "Content-Type": "application/x-ndjson" },
      }),
      () => {
        callbacks++;
      },
    ),
  );
  assert.equal(callbacks, 0);
});
test("checkpoint round trips conversation turn identities", () => {
  const checkpoint = {
    positionMs: 10,
    history: [{ id: "turn-1", role: "assistant", text: "回答" }],
  };
  assert.deepEqual(checkpointSchema.parse(checkpoint), checkpoint);
});

test("a mismatched revision is rejected for progress and both result transports", async () => {
  let phases = 0;
  const headers = { "Content-Type": "application/x-ndjson" };
  await assert.rejects(
    readQuestion(Response.json(valid), () => {}, 3),
    /轮次不匹配/,
  );
  await assert.rejects(
    readQuestion(
      new Response(JSON.stringify({ type: "result", result: valid }), {
        headers,
      }),
      () => {},
      3,
    ),
    /轮次不匹配/,
  );
  await assert.rejects(
    readQuestion(
      new Response('{"type":"progress","revision":2,"phase":"working"}\n', {
        headers,
      }),
      () => {
        phases++;
      },
      3,
    ),
    /轮次不匹配/,
  );
  assert.equal(phases, 0);
});
