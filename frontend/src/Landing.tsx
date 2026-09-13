import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Episode } from "@aside/engine/core";
import { t, useLocale } from "./i18n";
import { LanguageSelect } from "./LanguageSelect";
import "./landing.css";

export function Landing({
  episodes,
  loading,
  open,
  error,
  accountControl,
  spaceLink,
}: {
  episodes: Episode[];
  loading: boolean;
  open: (id: string) => void;
  error: string;
  accountControl?: ReactNode;
  spaceLink?: boolean;
}) {
  const locale = useLocale();
  const [step, setStep] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const ready = episodes.filter((episode) => episode.status === "ready");
  const demo =
    (locale === "en"
      ? (ready.find((episode) => episode.id === "eff-oligarchy") ??
        ready.find((episode) => episode.attribution?.language === "en"))
      : undefined) ??
    ready.find((episode) => episode.id === "demo-natural-resume") ??
    ready[0];
  const steps = [t("听到好奇的地方"), t("问一句，聊明白"), t("从刚才那句继续")];
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const targets = root.querySelectorAll("[data-reveal]:not(.revealed)");
    if (
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      targets.forEach((target) => target.classList.add("revealed"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -64px 0px", threshold: 0 },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [ready.length]);
  return (
    <div className="landing" ref={rootRef}>
      <header className="landing-nav">
        <a className="brand" href="/" aria-label="Aside">
          aside<span>◖</span>
        </a>
        <div className="landing-nav-actions">
          <a href="#how-it-works">{t("如何使用")}</a>
          {spaceLink && <a href="/space">{t("我的空间")}</a>}
          <LanguageSelect />
        </div>
      </header>
      <main className="landing-main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="hero-eyebrow">
              <span />
              {t("让播客成为一场对话")}
            </p>
            <h1 id="hero-title">
              {t("好问题，")}
              <br />
              <em>{t("不必等到最后。")}</em>
            </h1>
            <p className="hero-description">
              {t("听播客时，随时开口问。聊清楚了，再从刚才那句话自然接着听。")}
            </p>
            <div className="hero-actions">
              <button
                className="hero-cta"
                disabled={!demo}
                onClick={() => demo && open(demo.id)}
              >
                {t("试听")}
                <span aria-hidden="true">↗</span>
              </button>
              {accountControl}
            </div>
            <p className="hero-note">{t("无需注册 · 打开示例即可收听")}</p>
            {error && <p role="alert">{error}</p>}
          </div>
          <div className="hero-preview" aria-label={t("收听与提问示意")}>
            <div className="preview-caption">
              <span>ASIDE / ON AIR</span>
              <span>{t("交互示意")}</span>
            </div>
            <div className="preview-art" aria-hidden="true">
              <div className="record">
                <div className="record-center">a</div>
              </div>
              <span className="art-caption">
                A LITTLE ROOM
                <br />
                FOR CURIOSITY.
              </span>
            </div>
            <div className="preview-player">
              <span className="preview-play" aria-hidden="true">
                {step === 1 ? "Ⅱ" : "▶"}
              </span>
              <div>
                <strong>{t("给思考留一点空间")}</strong>
                <small>
                  {step === 1
                    ? t("暂停一下，聊两句")
                    : step === 2
                      ? t("回到完整的一句话")
                      : t("一段关于散步与灵感的播客")}
                </small>
              </div>
              <span className="preview-time">
                {step === 2 ? "00:10" : "00:18"}
              </span>
            </div>
            <div className="preview-progress">
              <span style={{ width: step === 2 ? "30%" : "52%" }} />
            </div>
            <div className="preview-conversation" aria-live="polite">
              {step === 0 ? (
                <p className="preview-quote">
                  {t(
                    "“当我们暂时离开屏幕，注意力会转向周围的声音、光线和风。”",
                  )}
                </p>
              ) : step === 1 ? (
                <>
                  <p className="preview-question">
                    {t("为什么散步会带来灵感？")}
                  </p>
                  <p className="preview-answer">
                    <span>aside</span>
                    {t(
                      "换个环境，让注意力松下来，原本没联系的想法就有机会碰到一起。",
                    )}
                  </p>
                </>
              ) : (
                <p className="preview-quote">
                  {t("↶ 留住你的好奇，也留住刚才的进度。")}
                </p>
              )}
            </div>
            <div className="preview-steps">
              {steps.map((label, index) => (
                <button
                  key={index}
                  aria-pressed={step === index}
                  onClick={() => setStep(index)}
                >
                  <span>0{index + 1}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>
        <section
          className="landing-how"
          id="how-it-works"
          aria-label={t("如何使用")}
        >
          <div className="how-intro" data-reveal>
            <span>{t("跟着好奇心走")}</span>
            <h2>{t("听进去，也聊进去。")}</h2>
          </div>
          <div className="how-step step-1" data-reveal>
            <span className="step-number">01</span>
            <h3>{steps[0]}</h3>
            <p>{t("选一段节目，像平时一样开始听。")}</p>
          </div>
          <div className="how-step step-2" data-reveal>
            <span className="step-number">02</span>
            <h3>{steps[1]}</h3>
            <p>{t("一个没听懂的概念，或一个突然冒出的想法，随时问。")}</p>
          </div>
          <div className="how-step step-3" data-reveal>
            <span className="step-number">03</span>
            <h3>{steps[2]}</h3>
            <p>{t("聊完回到完整的句子，不用自己拖进度条。")}</p>
          </div>
        </section>
        <section className="landing-library" aria-labelledby="sample-title">
          <div data-reveal>
            <span className="hero-eyebrow">{t("从这里开始")}</span>
            <h2 id="sample-title">{t("留几分钟，试着聊两句。")}</h2>
            <p>
              {t(
                "示例节目可直接收听；首次 AI 提问需完成验证，每天有免费试用额度。",
              )}
            </p>
          </div>
          <div className="sample-list">
            {loading && !episodes.length && !error ? (
              <>
                <div className="sample-skeleton" />
                <div className="sample-skeleton" />
                <div className="sample-skeleton" />
              </>
            ) : ready.length ? (
              ready.map((episode, index) => (
                <button
                  key={episode.id}
                  onClick={() => open(episode.id)}
                  data-reveal
                  style={
                    {
                      "--reveal-delay": `${Math.min(index, 5) * 70}ms`,
                    } as React.CSSProperties
                  }
                >
                  <span className="sample-icon" aria-hidden="true">
                    ▶
                  </span>
                  <span>
                    <strong>{episode.title}</strong>
                    <small>
                      {episode.attribution
                        ? `${episode.attribution.publisher} · English · ${t("节选")}`
                        : t("示例节目")}{" "}
                      · {Math.floor(episode.durationMs / 60000)}:
                      {String(
                        Math.floor(episode.durationMs / 1000) % 60,
                      ).padStart(2, "0")}
                    </small>
                  </span>
                  <span aria-hidden="true">↗</span>
                </button>
              ))
            ) : (
              <p className="sample-empty">{t("暂时没有可试听节目。")}</p>
            )}
          </div>
        </section>
      </main>
      <footer className="landing-footer" data-reveal>
        <span>aside</span>
        <p>{t("随时聊两句，再接着听。")}</p>
        <a href="#hero-title">{t("回到顶部")} ↑</a>
      </footer>
    </div>
  );
}
