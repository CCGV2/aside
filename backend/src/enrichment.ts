import { z } from "zod";
import { jsonrepair } from "jsonrepair";
import { writeFile } from "node:fs/promises";
const enrichment = z.object({
  summary: z.string(),
  hostStyle: z.string(),
  speakers: z.array(
    z.object({
      id: z.string(),
      presentation: z.enum(["masculine", "feminine", "unknown"]),
      durationMs: z.number().nonnegative(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  groups: z.array(z.object({ firstId: z.string(), lastId: z.string() })),
});

/** Persist evidence before parsing; never accept truncated or refused output. */
export async function parseEnrichment(
  raw: string,
  finishReason: string | null,
  artifact: string,
) {
  await writeFile(
    artifact,
    JSON.stringify({ raw, finishReason, status: "received" }),
  );
  let repaired = false;
  try {
    if (finishReason !== "stop") throw Error("模型输出未完整结束");
    const text = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    if (!text.startsWith("{") || !text.endsWith("}"))
      throw Error("模型未返回完整 JSON 对象");
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      value = JSON.parse(jsonrepair(text));
      repaired = true;
    }
    const parsed = enrichment.parse(value);
    await writeFile(
      artifact,
      JSON.stringify({
        raw,
        finishReason,
        status: "validated",
        repaired,
        parsed,
      }),
    );
    return parsed;
  } catch (error) {
    await writeFile(
      artifact,
      JSON.stringify({
        raw,
        finishReason,
        status: "invalid",
        repaired,
        error: error instanceof Error ? error.message : "Invalid output",
      }),
    );
    throw Error(
      "模型分析结果格式无效或不完整，原始回复已保存；已完成分段与转录可复用，请重试。",
    );
  }
}
