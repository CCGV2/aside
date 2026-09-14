import type { ReactNode } from "react";
import type { Episode } from "@aside/engine/core";
import { message, t } from "./i18n";

export interface AudioLibraryItem {
  id: string;
  title: string;
  meta: string;
  duration?: string;
  description?: string;
  canOpen?: boolean;
  progress?: number;
  actions?: ReactNode;
}
export function audioCard(episode: Episode): AudioLibraryItem {
  const seconds = Math.floor(episode.durationMs / 1000);
  return {
    id: episode.id,
    title: episode.title,
    duration: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
    meta: [
      episode.attribution?.publisher,
      `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
      episode.status === "ready"
        ? t("可对话")
        : message(episode.error || episode.stage),
    ]
      .filter(Boolean)
      .join(" · "),
    description: episode.analysis?.summary,
    canOpen: episode.durationMs > 0 && episode.status !== "blocked",
    progress:
      episode.status === "analyzing"
        ? Math.round(episode.progress * 100)
        : undefined,
  };
}
