import { z } from "zod";
import { buildContext, getPassage, searchPodcast } from "@aside/engine/server";
import { explicitResume, type Analysis } from "@aside/engine/core";
import type {
  QuestionRequest,
  QuestionResult,
  QuestionPhase,
} from "@aside/engine/contracts";
import type { QuestionModel, ToolResult } from "./question-model.js";
import { questionInstructions } from "./dialogue-policy.js";
import { questionTools } from "./question-tools.js";
export interface QuestionAnswerer {
  answer(
    analysis: Analysis,
    request: QuestionRequest,
    signal?: AbortSignal,
    progress?: (phase: QuestionPhase) => void,
  ): Promise<QuestionResult>;
}
/** Application policy: intent, heard-only retrieval, tool budget and sources. */
export class QuestionService implements QuestionAnswerer {
  constructor(private model: QuestionModel) {}
  async answer(
    analysis: Analysis,
    request: QuestionRequest,
    signal?: AbortSignal,
    progress?: (phase: QuestionPhase) => void,
  ): Promise<QuestionResult> {
    signal?.throwIfAborted();
    const resume = (): QuestionResult => ({
      revision: request.revision,
      answer: "",
      action: "resume",
      sources: [],
      tools: ["resume_podcast"],
    });
    const latest =
      request.history.filter((turn) => turn.role === "user").at(-1)?.text ?? "";
    if (explicitResume(latest)) return { ...resume(), tools: [] };
    const sources: QuestionResult["sources"] = [],
      used: string[] = [];
    let previousId: string | undefined;
    let toolResults: ToolResult[] = [];
    for (let round = 0; round < 5; round++) {
      signal?.throwIfAborted();
      progress?.(round === 0 ? "working" : "continuing");
      const response = await this.model.reply({
        context:
          round === 0
            ? buildContext(analysis, request.atMs, request.history)
            : undefined,
        previousId,
        toolResults,
        instructions: questionInstructions,
        tools: questionTools,
        signal,
      });
      signal?.throwIfAborted();
      previousId = response.id;
      toolResults = [];
      if (response.searchedWeb) used.push("search_web");
      sources.push(...response.sources);
      for (const call of response.calls) {
        used.push(call.name);
        progress?.("searching");
        let result: unknown;
        try {
          const args: unknown = JSON.parse(call.arguments);
          if (call.name === "resume_podcast") {
            z.object({}).strict().parse(args);
            return resume();
          }
          if (call.name === "get_passage") {
            const { atMs } = z
              .object({ atMs: z.number().finite().nonnegative() })
              .parse(args);
            result = getPassage(analysis, atMs, request.atMs);
          } else if (call.name === "search_podcast") {
            const { query } = z
              .object({ query: z.string().max(2000) })
              .parse(args);
            result = searchPodcast(analysis, query, request.atMs);
          } else result = { error: "Unknown tool" };
          if (Array.isArray(result))
            for (const passage of result)
              sources.push({ text: passage.text, startMs: passage.startMs });
        } catch {
          result = { error: "Invalid tool arguments" };
        }
        toolResults.push({ callId: call.id, value: result });
      }
      if (!response.calls.length)
        return {
          revision: request.revision,
          answer: response.answer,
          action: "answer",
          sources,
          tools: [...new Set(used)],
        };
    }
    throw Error("Tool round limit reached");
  }
}
