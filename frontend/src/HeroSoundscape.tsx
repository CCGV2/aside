import { useEffect, useRef } from "react";

// Deterministic curves keep the background stable between renders.
const curves = Array.from({ length: 16 }, (_, line) =>
  Array.from({ length: 101 }, (_, point) => {
    const x = point * 16;
    const envelope =
      Math.exp(-(((x - 280) / 240) ** 2)) +
      Math.exp(-(((x - 1320) / 260) ** 2));
    const y =
      230 +
      Math.sin(x / 110 + line * 0.12) * (38 + line * 5) * envelope +
      (line - 7.5) * 5;
    return `${point ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" "),
);

export function HeroSoundscape({
  variant = "hero",
}: {
  variant?: "hero" | "story" | "library";
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current!;
    const hero = element.parentElement!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const bounds = hero.getBoundingClientRect();
      const progress =
        reduced.matches || variant !== "hero"
          ? 0
          : Math.max(0, Math.min(1, -bounds.top / bounds.height));
      element.style.setProperty("--sound-scale", String(1 - progress * 0.8));
      element.style.setProperty("--sound-shift", `${progress * 140}px`);
      element.style.setProperty("--sound-opacity", String(1 - progress));
      element.dataset.active = String(
        bounds.bottom > 0 &&
          bounds.top < window.innerHeight &&
          !document.hidden &&
          !reduced.matches,
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", schedule);
    reduced.addEventListener("change", schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", schedule);
      reduced.removeEventListener("change", schedule);
    };
  }, [variant]);
  return (
    <div
      ref={root}
      className={`soundscape ${variant}-soundscape`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 1600 460" preserveAspectRatio="none" fill="none">
        <g>
          {curves.map((d, index) => (
            <path key={index} d={d} />
          ))}
        </g>
      </svg>
    </div>
  );
}
