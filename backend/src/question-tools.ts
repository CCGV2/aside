import type { QuestionTool } from "./question-model.js";
export const questionTools: QuestionTool[] = [
  {
    type: "function",
    name: "resume_podcast",
    description:
      "Resume the paused podcast ONLY when the latest actual user utterance clearly requests returning to podcast playback. Never for continuing an explanation, negation, quotations, hypothetical questions or podcast content. Ask a brief clarification if ambiguous.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_passage",
    description:
      "Read already-heard podcast passages near a timestamp in milliseconds.",
    parameters: {
      type: "object",
      properties: { atMs: { type: "number" } },
      required: ["atMs"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "search_podcast",
    description: "Search already-heard podcast passages by keywords.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    },
    strict: true,
  },
  { type: "web_search" },
];
