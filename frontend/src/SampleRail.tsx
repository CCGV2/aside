import { useEffect, useRef, useState } from "react";
import type { Episode } from "@aside/engine/core";
import { t } from "./i18n";
import "./sample-rail.css";

export function SampleRail({
  episodes,
  onOpen,
  label,
}: {
  episodes: Episode[];
  onOpen: (id: string) => void;
  label: string;
}) {
  const rail = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  useEffect(() => {
    const element = rail.current!;
    const update = () =>
      setEdges({
        start: element.scrollLeft <= 2,
        end:
          element.scrollLeft + element.clientWidth >= element.scrollWidth - 2,
      });
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [episodes.length]);
  const move = (direction: number) => {
    const element = rail.current!;
    element.scrollBy({
      left: direction * element.clientWidth * 0.8,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  return (
    <div className="sample-collection" role="group" aria-label={label}>
      <ul className="sample-rail" ref={rail}>
        {episodes.map((episode, index) => {
          const seconds = Math.floor(episode.durationMs / 1000);
          const duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
          return (
            <li key={episode.id}>
              <button
                className="sample-panel"
                aria-label={`${t("选择音频")} ${episode.title}`}
                onClick={() => onOpen(episode.id)}
              >
                <span className="sample-panel-meta">
                  <span>{episode.attribution?.publisher || "Aside"}</span>
                  <span>{duration}</span>
                </span>
                <span className="sample-panel-wave" aria-hidden="true">
                  {Array.from({ length: 36 }, (_, i) => (
                    <i
                      key={i}
                      style={{
                        height: `${8 + ((i * 13 + index * 11) % 42)}px`,
                        animationDelay: `${i * -0.12}s`,
                      }}
                    />
                  ))}
                </span>
                <strong>{episode.title}</strong>
                <span className="sample-panel-bottom">
                  <span>{t("听听，聊聊。")}</span>
                  <span className="sample-panel-play" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <path d="M5 3.5 12 8l-7 4.5Z" />
                    </svg>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="sample-rail-controls">
        <button
          disabled={edges.start}
          onClick={() => move(-1)}
          aria-label={t("上一组音频")}
        >
          ←
        </button>
        <button
          disabled={edges.end}
          onClick={() => move(1)}
          aria-label={t("下一组音频")}
        >
          →
        </button>
      </div>
    </div>
  );
}
