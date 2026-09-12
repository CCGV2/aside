import { test } from "node:test";
import assert from "node:assert/strict";
import { OpenAIProvider } from "../backend/src/provider.js";
import type { QuestionModel } from "../backend/src/question-model.js";

test("OpenAI adapter maps question input, tool output, citations and cancellation", async (t) => {
  const provider = new OpenAIProvider("test-placeholder", "test-model");
  const abort = new AbortController();
  const inputs: unknown[] = [];
  const calls = t.mock.method(
    provider.client.responses,
    "create",
    async (body: unknown, options: { signal?: AbortSignal }) => {
      inputs.push(body);
      assert.equal(options.signal, abort.signal);
      return {
        id: "response-1",
        output_text: "回答",
        output: [
          { type: "web_search_call" },
          {
            type: "function_call",
            call_id: "call-1",
            name: "search_podcast",
            arguments: '{"query":"词语"}',
          },
          {
            type: "message",
            content: [
              {
                type: "output_text",
                annotations: [
                  {
                    type: "url_citation",
                    title: "Source",
                    url: "https://example.com/source",
                  },
                ],
              },
            ],
          },
        ],
      };
    },
  );
  const request: Parameters<QuestionModel["reply"]>[0] = {
    instructions: "政策",
    tools: [],
    toolResults: [],
    signal: abort.signal,
    context: {
      playheadMs: 10,
      currentPassage: null,
      recentTranscript: [],
      earlierExcerpts: [],
      hostStyle: "",
      history: [],
    },
  };
  const result = await provider.reply(request);
  assert.deepEqual(result, {
    id: "response-1",
    answer: "回答",
    searchedWeb: true,
    sources: [{ text: "Source", url: "https://example.com/source" }],
    calls: [
      { id: "call-1", name: "search_podcast", arguments: '{"query":"词语"}' },
    ],
  });
  assert.deepEqual(inputs[0], {
    model: "test-model",
    instructions: "政策",
    input: [{ role: "user", content: JSON.stringify(request.context) }],
    previous_response_id: undefined,
    tools: [],
    max_output_tokens: 1000,
  });
  await provider.reply({
    ...request,
    context: undefined,
    previousId: "response-1",
    toolResults: [{ callId: "call-1", value: { text: "已经听过" } }],
  });
  assert.deepEqual((inputs[1] as { input: unknown }).input, [
    {
      type: "function_call_output",
      call_id: "call-1",
      output: '{"text":"已经听过"}',
    },
  ]);
  assert.equal(calls.mock.callCount(), 2);
});
