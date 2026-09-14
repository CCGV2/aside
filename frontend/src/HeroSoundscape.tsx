import { useEffect, useRef } from "react";

const lines = 16;
const points = 101;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

// The two swells stay in place; only the ripple inside them travels.
const envelope = Array.from({ length: points }, (_, point) => {
  const x = point * 16;
  return (
    Math.exp(-(((x - 280) / 240) ** 2)) + Math.exp(-(((x - 1320) / 260) ** 2))
  );
});
const commands = Array.from(
  { length: points },
  (_, point) => `${point ? " L" : "M"}${point * 16},`,
);

// Deterministic at time 0, so the first render and reduced motion match.
function curve(line: number, time: number) {
  const swell = 1 + Math.sin(time * 0.3) * Math.cos(line * 0.5) * 0.07;
  const amplitude = (38 + line * 5) * swell;
  const phase = line * 0.12 - time * 0.24;
  const baseline = 230 + (line - 7.5) * 5;
  let d = "";
  for (let point = 0; point < points; point++) {
    const y =
      baseline +
      Math.sin((point * 16) / 110 + phase) * amplitude * envelope[point];
    d += commands[point] + Math.round(y * 10) / 10;
  }
  return d;
}

const still = Array.from({ length: lines }, (_, line) => curve(line, 0));

export function HeroSoundscape({
  variant = "hero",
  paused = false,
}: {
  variant?: "hero" | "story" | "library";
  paused?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const held = useRef(paused);
  const wake = useRef(() => {});
  useEffect(() => {
    const element = root.current!;
    const section = element.parentElement!;
    const paths = element.querySelectorAll("path");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let frame = 0;
    let last = 0;
    let clock = 0;
    let speed = 0;
    // Drift only while on screen, and ease to a stop rather than freezing.
    const flow = (now: number) => {
      frame = 0;
      const running =
        visible && !document.hidden && !reduced.matches && !held.current;
      const delta = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      speed += ((running ? 1 : 0) - speed) * Math.min(1, delta * 2.5);
      clock += delta * speed;
      paths.forEach((path, line) => path.setAttribute("d", curve(line, clock)));
      if (running || speed > 0.01) frame = requestAnimationFrame(flow);
      else last = 0;
    };
    wake.current = () => {
      if (!frame) frame = requestAnimationFrame(flow);
    };
    let exitFrame = 0;
    // The hero publishes its exit progress; CSS decides what moves with it.
    const exit = () => {
      exitFrame = 0;
      const bounds = section.getBoundingClientRect();
      const progress = reduced.matches
        ? 0
        : clamp(-bounds.top / bounds.height);
      section.style.setProperty("--hero-progress", String(progress));
      // Hold the shape while the headline is read, then fold it away.
      section.style.setProperty("--hero-exit", String(progress * progress));
    };
    const scheduleExit = () => {
      if (!exitFrame) exitFrame = requestAnimationFrame(exit);
    };
    const changed = () => {
      wake.current();
      if (variant === "hero") scheduleExit();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      wake.current();
    });
    observer.observe(section);
    document.addEventListener("visibilitychange", changed);
    reduced.addEventListener("change", changed);
    if (variant === "hero") {
      window.addEventListener("scroll", scheduleExit, { passive: true });
      window.addEventListener("resize", scheduleExit);
      exit();
    }
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(exitFrame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", changed);
      reduced.removeEventListener("change", changed);
      window.removeEventListener("scroll", scheduleExit);
      window.removeEventListener("resize", scheduleExit);
    };
  }, [variant]);
  useEffect(() => {
    held.current = paused;
    wake.current();
  }, [paused]);
  return (
    <div
      ref={root}
      className={`soundscape ${variant}-soundscape`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 1600 460" preserveAspectRatio="none" fill="none">
        <g>
          {still.map((d, index) => (
            <path key={index} d={d} />
          ))}
        </g>
      </svg>
    </div>
  );
}
