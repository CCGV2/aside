import type {
  Episode,
  MicrophoneConfig,
  VoiceLifecycleConfig,
} from "@aside/engine/core";
import {
  checkpointSchema,
  errorSchema,
  type Checkpoint,
  type LiveRequest,
  type LiveResult,
  type QuestionRequest,
  type QuestionResult,
  type QuestionPhase,
} from "@aside/engine/contracts";
import { readQuestion } from "./question-stream";
export interface PlayerBackend {
  question(
    id: string,
    request: QuestionRequest,
    signal: AbortSignal,
    progress: (phase: QuestionPhase) => void,
  ): Promise<QuestionResult>;
  live(id: string, request: LiveRequest): Promise<LiveResult>;
  transcribe(id: string, audio: Blob, signal: AbortSignal): Promise<string>;
  usage(
    id: string,
    data: { sessionId: string; seconds: number; finalized: boolean },
  ): Promise<void>;
}
export interface PlayerHealth {
  liveConfigured: boolean;
  microphone: MicrophoneConfig;
  voiceLifecycle: VoiceLifecycleConfig;
}
const json = (body: unknown, method = "POST"): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch("/api" + path, init);
  if (!response.ok) {
    const error = errorSchema.safeParse(
      await response.json().catch(() => null),
    );
    throw Error(error.success ? error.data.error : response.statusText);
  }
  return response.json();
}
export const playerBackend: PlayerBackend = {
  async question(id, request, signal, progress) {
    const result = await readQuestion(
      await fetch(`/api/episodes/${id}/question`, {
        ...json(request),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        signal,
      }),
      progress,
      request.revision,
    );
    return result;
  },
  live: (id, request) => api(`/episodes/${id}/live`, json(request)),
  async transcribe(id, audio, signal) {
    const body = new FormData();
    body.append("audio", audio, "question.wav");
    return (
      await api<{ text: string }>(`/episodes/${id}/transcribe-question`, {
        method: "POST",
        body,
        signal,
      })
    ).text;
  },
  async usage(id, data) {
    await api(`/episodes/${id}/usage`, { ...json(data), keepalive: true });
  },
};
export const episodeLibrary = {
  list: () => api<Episode[]>("/episodes"),
  get: (id: string) => api<Episode>(`/episodes/${id}`),
  async checkpoint(id: string) {
    const data = await api<unknown>(`/episodes/${id}/checkpoint`);
    return data === null ? null : checkpointSchema.parse(data);
  },
  save: (id: string, checkpoint: Checkpoint) =>
    api(`/episodes/${id}/checkpoint`, json(checkpoint, "PUT")),
  health: () => api<PlayerHealth>("/health"),
  retry: (id: string) => api(`/episodes/${id}/retry`, json({})),
  upload(file: File) {
    const body = new FormData();
    body.append("audio", file);
    return api<Episode>("/episodes", { method: "POST", body });
  },
};
