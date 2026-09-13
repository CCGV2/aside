import { t, useLocale } from "./i18n";
import React, { useEffect, useRef, useState } from "react";
import type { Passage } from "@aside/engine/core";

const time = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export function Transcript({
  passages,
  positionMs,
  onSeek,
}: {
  passages: Passage[];
  positionMs: number;
  onSeek: (atMs: number) => void;
}) {
  useLocale();
  const viewport = useRef<HTMLDivElement>(null);
  const activeLine = useRef<HTMLParagraphElement>(null);
  const [following, setFollowing] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeIndex = passages.findLastIndex((p) => p.startMs <= positionMs);
  useEffect(() => {
    const box = viewport.current;
    const line = activeLine.current;
    if (!following || !box || !line) return;
    const boxRect = box.getBoundingClientRect();
    const lineRect = line.getBoundingClientRect();
    box.scrollTo({
      top:
        box.scrollTop +
        lineRect.top -
        boxRect.top -
        (box.clientHeight - lineRect.height) / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [activeIndex, following]);
  return (
    <>
      <div className="panel-heading">
        <h2>{t("节目逐字稿")}</h2>
        {following ? (
          <span>{t("跟随播放")}</span>
        ) : (
          <button
            className="transcript-follow"
            onClick={() => setFollowing(true)}
          >
            {t("回到当前播放")}
          </button>
        )}
      </div>
      <div
        className="transcript-lyrics"
        ref={viewport}
        tabIndex={0}
        role="region"
        aria-label={t("节目逐字稿")}
        onWheel={() => setFollowing(false)}
        onTouchStart={() => setFollowing(false)}
        onPointerDown={() => setFollowing(false)}
        onKeyDown={(e) => {
          if (
            [
              "ArrowUp",
              "ArrowDown",
              "PageUp",
              "PageDown",
              "Home",
              "End",
              " ",
            ].includes(e.key)
          )
            setFollowing(false);
        }}
      >
        {passages.length ? (
          passages.map((p, i) => (
            <p
              key={p.id}
              ref={i === activeIndex ? activeLine : undefined}
              aria-current={i === activeIndex ? "true" : undefined}
              className={`transcript-line${i === activeIndex ? " is-current" : i < activeIndex ? " is-past" : ""}${selectedId === p.id ? " is-selected" : ""}`}
              onClick={() => setSelectedId(p.id)}
            >
              <span className="transcript-cue">
                <span className="transcript-time">{time(p.startMs)}</span>
                <button
                  type="button"
                  className="transcript-jump"
                  aria-label={`${t("从这句播放")} ${time(p.startMs)}`}
                  title={`${t("从这句播放")} · ${time(p.startMs)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedId(null);
                    setFollowing(true);
                    onSeek(p.startMs);
                  }}
                >
                  ▶
                </button>
              </span>
              <span>{p.text}</span>
            </p>
          ))
        ) : (
          <p className="transcript-empty">
            {t("音频分析完成后，逐字稿会出现在这里。")}
          </p>
        )}
      </div>
    </>
  );
}
