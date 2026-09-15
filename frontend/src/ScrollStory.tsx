import { useEffect, useRef, useState } from "react";
import { HeroSoundscape } from "./HeroSoundscape";
import { t } from "./i18n";
import "./scroll-story.css";

const stops = [0.04, 0.34, 0.6, 0.88];
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function ScrollStory() {
  const root = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const manual = useRef(false);
  const controls = useRef<HTMLDivElement>(null);
  const steps = [t("听一段"), t("说说你的想法"), t("一起聊下去"), t("接着听")];
  const headlines = [
    t("好内容，值得听进去。"),
    t("有想法，就加入。"),
    t("它听懂的不止这一句。"),
    t("聊完，刚好接着听。"),
  ];
  const captions = [
    t("访谈、播客、分享。每一段声音，都可以是对话的开始。"),
    t("一个问题，一点不同意见。让单向的收听，变成双向的交流。"),
    t("Aside 结合前面的内容回应，让你的好奇继续往前走。"),
    t("回到刚才完整的一句话，思路和进度都接得上。"),
  ];
  useEffect(() => {
    const element = root.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const short = window.matchMedia("(max-height: 700px), (max-width: 360px)");
    let frame = 0;
    const update = () => {
      frame = 0;
      if (reduced.matches || short.matches) return;
      const rect = element.getBoundingClientRect();
      const pin = element.querySelector<HTMLElement>(".story-pin")!;
      const distance = Math.max(1, element.offsetHeight - pin.offsetHeight);
      const progress = clamp(-rect.top / distance);
      element.style.setProperty("--story-progress", String(progress));
      element.style.setProperty(
        "--story-scale",
        String(0.94 + clamp(progress / 0.22) * 0.06),
      );
      if (!manual.current)
        setStep(
          progress < 0.25 ? 0 : progress < 0.5 ? 1 : progress < 0.76 ? 2 : 3,
        );
    };
    const scroll = () => {
      manual.current = false;
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", scroll);
    reduced.addEventListener("change", scroll);
    const observer = new ResizeObserver(() => {
      if (!frame) frame = requestAnimationFrame(update);
    });
    observer.observe(element);
    update();
    return () => {
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", scroll);
      reduced.removeEventListener("change", scroll);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  // Slide the raised pill under whichever step is current.
  useEffect(() => {
    const element = controls.current!;
    const place = () => {
      const active = element.querySelector<HTMLElement>('[aria-pressed="true"]');
      const thumb = element.querySelector<HTMLElement>(".story-controls-thumb");
      if (!active || !thumb) return;
      // Clamp to the track so a stale position never widens the page mid-resize.
      thumb.style.width = `min(${active.offsetWidth}px, calc(100% - 8px))`;
      thumb.style.left = `min(${active.offsetLeft}px, calc(100% - 4px - ${active.offsetWidth}px))`;
      element.classList.add("ready");
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    return () => observer.disconnect();
  }, [step]);
  function select(index: number) {
    const element = root.current!;
    setStep(index);
    manual.current = true;
    if (
      window.matchMedia(
        "(prefers-reduced-motion: reduce), (max-height: 700px), (max-width: 360px)",
      ).matches
    )
      return;
    const pin = element.querySelector<HTMLElement>(".story-pin")!;
    window.scrollTo({
      top:
        window.scrollY +
        element.getBoundingClientRect().top +
        stops[index] * (element.offsetHeight - pin.offsetHeight),
      behavior: "instant",
    });
  }
  return (
    <section
      ref={root}
      id="how-it-works"
      className="scroll-story"
      data-step={step}
      aria-label={t("收听与对话示意")}
    >
      <div className="story-pin">
        <HeroSoundscape variant="story" paused={step === 1 || step === 2} />
        <div className="story-heading">
          <span className="story-eyebrow">ASIDE / {t("交互示意")}</span>
          <h2 key={step}>{headlines[step]}</h2>
          <p>{captions[step]}</p>
        </div>
        <div className="story-stage">
          <div className="story-toolbar">
            <span className="story-wordmark">
              Aside <img src="/aside-mark.svg" alt="" />
            </span>
            <span>{t("给思考留一点空间")}</span>
            <span className="story-status">
              {step === 1 || step === 2 ? t("暂停一下，聊两句") : t("听一段")}
            </span>
          </div>
          <div className="story-scene">
            <div className="story-transcript">
              <span className="story-label">01 / {t("听一段")}</span>
              <p className="story-quiet">{t("有时候，新的想法不在屏幕里。")}</p>
              <p className="story-spoken">
                {t("当我们暂时离开屏幕，")}
                <span>{t("注意力会转向周围的声音、光线和风。")}</span>
              </p>
              <p className="story-quiet story-next">
                {t("给思考留一点空间。")}
              </p>
              <div className="story-wave" aria-hidden="true">
                {Array.from({ length: 32 }, (_, i) => (
                  <i
                    key={i}
                    style={{
                      height: `${8 + ((i * 17 + 7) % 37)}px`,
                      animationDelay: `${i * -0.13}s`,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="story-dialogue">
              <span className="story-label">02 / {t("说说你的想法")}</span>
              <div className="story-invitation" aria-hidden={step !== 0}>
                <span>＋</span>
                <p>{t("这里，留给你的想法。")}</p>
              </div>
              <div className="story-user" aria-hidden={step < 1}>
                <span className="story-avatar story-guest" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21v-2a8 8 0 0 1 16 0v2Z" />
                  </svg>
                </span>
                <div>
                  <small>{t("你")}</small>
                  <p className="preview-question">
                    {t("但我散步时反而容易走神，这和刚才说的矛盾吗？")}
                  </p>
                </div>
              </div>
              <div className="story-agent" aria-hidden={step < 2}>
                <span className="story-avatar" aria-hidden="true">
                  <img src="/aside-mark.svg" alt="" />
                </span>
                <div>
                  <small>Aside · AI</small>
                  <p>
                    {t(
                      "不矛盾。注意力离开屏幕，不一定是更专注。走神，也可能带来新的联想。",
                    )}
                  </p>
                </div>
              </div>
              <div className="story-resume" aria-hidden={step !== 3}>
                ↶ {t("回到完整的一句话")}
              </div>
            </div>
          </div>
          <div className="story-transport">
            <span aria-hidden="true">
              {step === 1 || step === 2 ? "Ⅱ" : "▶"}
            </span>
            <span className="preview-time">
              {step === 3 ? "00:10" : "00:18"}
            </span>
            <div className="story-timeline">
              <span />
            </div>
            <span>02:32</span>
          </div>
        </div>
        <div
          className="story-controls"
          ref={controls}
          aria-label={t("交互示意")}
        >
          <span className="story-controls-thumb" aria-hidden="true" />
          {steps.map((label, index) => (
            <button
              key={index}
              aria-pressed={step === index}
              onClick={() => select(index)}
            >
              <span>0{index + 1}</span>
              {label}
            </button>
          ))}
        </div>
        <a className="story-skip" href="#sample-title">
          {t("选一段，亲自试试")} <span aria-hidden="true">↓</span>
        </a>
      </div>
    </section>
  );
}
