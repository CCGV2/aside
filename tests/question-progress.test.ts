import { test } from "node:test";
import assert from "node:assert/strict";
import { QuestionProgress } from "../frontend/src/question-progress.js";
import { readQuestion } from "../frontend/src/question-stream.js";

test("progress skips fast answers, limits long answers, and cancels stale prompts", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const spoken: string[] = [];
  const fast = new QuestionProgress((p) => spoken.push(p));
  fast.update("working");
  t.mock.timers.tick(1000);
  fast.close();
  t.mock.timers.tick(1000);
  assert.equal(spoken.length, 0);
  const slow = new QuestionProgress((p) => spoken.push(p));
  slow.update("working");
  slow.update("searching");
  t.mock.timers.tick(1500);
  assert.deepEqual(spoken, ["searching"]);
  slow.update("continuing");
  t.mock.timers.tick(7999);
  assert.equal(spoken.length, 1);
  t.mock.timers.tick(1);
  assert.deepEqual(spoken, ["searching", "continuing"]);
  slow.update("searching");
  t.mock.timers.tick(20000);
  assert.equal(spoken.length, 2);
  slow.close();
});
test("progress is delivered before final result, even across byte boundaries", async () => {
  let sink!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      sink = c;
    },
  });
  const phases: string[] = [];
  const result = readQuestion(
    new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson" },
    }),
    (p) => phases.push(p),
  );
  const bytes = new TextEncoder().encode(
    JSON.stringify({ type: "progress", phase: "searching" }) + "\n",
  );
  sink.enqueue(bytes.slice(0, 8));
  sink.enqueue(bytes.slice(8));
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(phases, ["searching"]);
  const end = new TextEncoder().encode(
    JSON.stringify({ type: "result", result: { answer: "中文或English" } }) +
      "\n",
  );
  for (const b of end) sink.enqueue(new Uint8Array([b]));
  sink.close();
  assert.deepEqual(await result, { answer: "中文或English" });
});
test("stream errors and missing final result fail instead of silently completing", async () => {
  const headers = { "Content-Type": "application/x-ndjson" };
  await assert.rejects(
    readQuestion(
      new Response('{"type":"error","error":"lookup failed"}\n', { headers }),
      () => {},
    ),
    /lookup failed/,
  );
  await assert.rejects(
    readQuestion(
      new Response('{"type":"progress","phase":"working"}\n', { headers }),
      () => {},
    ),
    /中断/,
  );
});
