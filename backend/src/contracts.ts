import { z } from "zod";
export const questionSchema = z.object({
  atMs: z.number().finite().nonnegative(),
  revision: z.number().int().nonnegative(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().max(12000),
      }),
    )
    .max(100),
});
export const liveSchema = z.object({
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().max(12000),
      }),
    )
    .max(100)
    .default([]),
  sdp: z.string().min(1).max(64000),
  atMs: z.number().finite().nonnegative(),
});
export const checkpointSchema = z.object({
  positionMs: z.number().finite().nonnegative(),
  resumeMs: z.number().finite().nonnegative().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().max(12000),
      }),
    )
    .max(100),
});
export type QuestionRequest = z.infer<typeof questionSchema>;
export interface QuestionResult {
  revision: number;
  answer: string;
  action: "answer" | "resume";
  sources: { text: string; startMs?: number; url?: string }[];
  tools: string[];
}
