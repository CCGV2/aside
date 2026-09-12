import { test } from "node:test";
import assert from "node:assert/strict";
import { QuestionService } from "../backend/src/question-service.js";
import type {
  ModelReply,
  QuestionModel,
} from "../backend/src/question-model.js";
import type { Analysis } from "@aside/engine/core";
const analysis: Analysis = {
  version: "test",
  passages: [
    {
      id: "heard",
      startMs: 0,
      endMs: 1000,
      text: "散步 helps thinking",
      speaker: "host",
    },
    {
      id: "future",
      startMs: 2000,
      endMs: 3000,
      text: "散步 future secret",
      speaker: "host",
    },
  ],
  anchors: [],
  speakers: [],
  summary: "future summary",
  hostStyle: "clear",
  voice: "feminine",
  voiceReason: "test",
  source: "demo",
};
const request = {
  revision: 3,
  atMs: 1500,
  history: [{ role: "user" as const, text: "解释散步" }],
};
const reply = (overrides: Partial<ModelReply> = {}): ModelReply => ({
  id: "r",
  answer: "说明",
  sources: [],
  searchedWeb: false,
  calls: [],
  ...overrides,
});
test("question flow executes heard-only tools and combines external citations without an SDK", async () => {
  const inputs: Parameters<QuestionModel["reply"]>[0][] = [];
  const model: QuestionModel = {
    async reply(input) {
      inputs.push(input);
      return inputs.length === 1
        ? reply({
            id: "first",
            calls: [
              {
                id: "search",
                name: "search_podcast",
                arguments: '{"query":"散步"}',
              },
            ],
          })
        : reply({
            sources: [
              { text: "Reference", url: "https://example.com/reference" },
            ],
            searchedWeb: true,
          });
    },
  };
  const phases: string[] = [];
  const result = await new QuestionService(model).answer(
    analysis,
    request,
    undefined,
    (phase) => phases.push(phase),
  );
  assert.deepEqual(result.tools, ["search_podcast", "search_web"]);
  assert.equal(result.sources.length, 2);
  assert.equal(JSON.stringify(inputs).includes("future secret"), false);
  assert.equal(JSON.stringify(inputs).includes("future summary"), false);
  assert.equal(inputs[1].previousId, "first");
  assert.equal(inputs[1].context, undefined);
  assert.deepEqual(
    inputs[1].toolResults.map((result) => result.callId),
    ["search"],
  );
  assert.deepEqual(phases, ["working", "searching", "continuing"]);
});
test("invalid or unknown tool calls return structured errors to the model", async () => {
  let input: Parameters<QuestionModel["reply"]>[0] | undefined;
  let count = 0;
  const model: QuestionModel = {
    async reply(request) {
      if (count++ === 0)
        return reply({
          calls: [
            { id: "bad", name: "get_passage", arguments: '{"atMs":-1}' },
            { id: "json", name: "search_podcast", arguments: "broken" },
            { id: "unknown", name: "unregistered", arguments: "{}" },
          ],
        });
      input = request;
      return reply();
    },
  };
  await new QuestionService(model).answer(analysis, request);
  assert.deepEqual(input?.toolResults, [
    { callId: "bad", value: { error: "Invalid tool arguments" } },
    { callId: "json", value: { error: "Invalid tool arguments" } },
    { callId: "unknown", value: { error: "Unknown tool" } },
  ]);
});
test("explicit continuation bypasses the model and semantic continuation stops the tool loop", async () => {
  let calls = 0;
  const model: QuestionModel = {
    async reply() {
      calls++;
      return reply({
        calls: [{ id: "resume", name: "resume_podcast", arguments: "{}" }],
      });
    },
  };
  const service = new QuestionService(model);
  assert.equal(
    (
      await service.answer(analysis, {
        ...request,
        history: [{ role: "user", text: "继续" }],
      })
    ).action,
    "resume",
  );
  assert.equal(calls, 0);
  const result = await service.answer(analysis, request);
  assert.equal(result.action, "resume");
  assert.equal(result.answer, "");
  assert.equal(calls, 1);
});
test("tool budget and cancellation stop further model work", async () => {
  let calls = 0;
  const looping: QuestionModel = {
    async reply() {
      calls++;
      return reply({
        calls: [
          { id: "loop", name: "search_podcast", arguments: '{"query":"散步"}' },
        ],
      });
    },
  };
  await assert.rejects(
    new QuestionService(looping).answer(analysis, request),
    /round limit/,
  );
  assert.equal(calls, 5);
  const abort = new AbortController();
  const cancelled: QuestionModel = {
    async reply(input) {
      assert.equal(input.signal, abort.signal);
      abort.abort();
      return reply();
    },
  };
  await assert.rejects(
    new QuestionService(cancelled).answer(analysis, request, abort.signal),
    { name: "AbortError" },
  );
  await assert.rejects(
    new QuestionService(looping).answer(analysis, request, abort.signal),
    { name: "AbortError" },
  );
  assert.equal(calls, 5);
});
