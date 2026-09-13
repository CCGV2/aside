import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AccountControl } from "./AccountControl";
import { LanguageSelect } from "./LanguageSelect";
import { Transcript } from "./Transcript";
import { message, resumeLabel, t } from "./i18n";
import { names, type PlayerController } from "./usePlayerController";

export const formatPlayerTime = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export function PlayerView({
  player,
  onAuthChanged,
}: {
  player: PlayerController;
  onAuthChanged: () => Promise<void>;
}) {
  const {
    listeningMode,
    manualHeld,
    beginManual,
    endManual,
    followupMs,
    resumeSeconds,
    resumeHeld,
    holdResume,
    returnContext,
    latencies,
    episode,
    state,
    history,
    error,
    configured,
    liveStatus,
    question,
    busy,
    debug,
    events,
    sources,
    audio,
    seek,
    submitQuestion,
    metadataLoaded,
    audioTick,
    setPlaybackRate,
    setError,
    setDebug,
    setQuestion,
    requestResume,
    listeningActive,
    startListening,
    stopListening,
    retry,
  } = player;
  const [compactEpisode, setCompactEpisode] = useState("");
  const compact = !!episode && compactEpisode === episode.id;
  const [mobileTab, setMobileTab] = useState<"transcript" | "chat">(
    "transcript",
  );
  useEffect(() => {
    if (state.interruption) setMobileTab("chat");
  }, [state.interruption]);
  useEffect(() => {
    if (listeningActive) setMobileTab("transcript");
  }, [listeningActive]);
  const layoutTransition = useRef<ViewTransition | undefined>(undefined);
  useEffect(() => {
    const target = listeningActive && episode ? episode.id : "";
    if (target === compactEpisode) return;
    layoutTransition.current?.skipTransition();
    const update = () => {
      if (target) window.scrollTo(0, 0);
      setCompactEpisode(target);
    };
    if (
      !document.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      update();
      return;
    }
    layoutTransition.current = document.startViewTransition(() =>
      flushSync(update),
    );
    // Skips and browser animation timeouts reject ready even when React has
    // committed the new layout. Keep playback independent of that animation.
    const transition = layoutTransition.current;
    void transition.ready.catch(() => transition.skipTransition());
  }, [listeningActive, episode?.id, compactEpisode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.defaultPrevented
      )
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest(
            "input, textarea, select, button, a, summary, [role='button'], [role='textbox']",
          ))
      )
        return;
      if (!episode) return;
      event.preventDefault();
      if (event.repeat) return;
      if (listeningActive) stopListening();
      else startListening();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [episode, listeningActive, startListening, stopListening]);

  useEffect(() => {
    if (!manualHeld) return;
    const release = () => endManual();
    const hide = () => {
      if (document.hidden) release();
    };
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [manualHeld, endManual]);

  const messages = useRef<HTMLDivElement>(null);
  const debugAllowed =
    import.meta.env.DEV ||
    new URLSearchParams(window.location.search).has("debug");
  useLayoutEffect(() => {
    const box = messages.current;
    if (!box) return;
    const scrollToBottom = () => {
      box.scrollTop = box.scrollHeight;
    };
    scrollToBottom();
    const resize = new ResizeObserver(scrollToBottom);
    resize.observe(box);
    return () => resize.disconnect();
  }, [history, busy, episode?.id, compact]);

  if (!episode) return null;
  return (
    <main className={compact ? "player-main listening-layout" : "player-main"}>
      <header className="player-header">
        <span>{t("你的播客，留一点对话的空间")}</span>
        <LanguageSelect />
        <AccountControl onAuthChanged={onAuthChanged} />
      </header>
      {error && (
        <div role="alert" className="alert">
          {message(error)}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      <section className={`player-card${compact ? " compact" : ""}`}>
        <div className="cover">
          <span>ASIDE / AUDIO NOTES</span>
          <div className="cover-art">
            {Array.from({ length: 25 }, (_, i) => (
              <i
                key={i}
                style={{ height: 25 + Math.sin(i * 0.75) ** 2 * 100 }}
              />
            ))}
          </div>
          <em>{t("留白，也是对话。")}</em>
        </div>
        <div className="player-content">
          <div className="eyebrow">
            {episode.analysis?.source === "demo"
              ? t("本地演示 · 合成音频 / 预设分段")
              : t("正在收听")}
          </div>
          <h1>{episode.title}</h1>
          <p className="description">
            {episode.analysis
              ? episode.analysis.summary.slice(0, 130)
              : message(episode.stage)}
          </p>
          {episode.status !== "ready" && (
            <>
              <progress max={1} value={episode.progress} />
              <p>{message(episode.error ?? "")}</p>
              {["blocked", "failed"].includes(episode.status) && (
                <button
                  onClick={() => void retry().catch((e) => setError(e.message))}
                >
                  {t("重新分析")}
                </button>
              )}
            </>
          )}
          <div className="status">
            <span
              className={`dot ${state.mode === "playing" ? "green" : ""}`}
            />
            {t(names[state.mode])}
            {episode.analysis && (
              <span className="voice-label">
                {episode.analysis.voice === "feminine" ? t("女声") : t("男声")}{" "}
                {t("· 自动匹配")}
              </span>
            )}
          </div>
        </div>
      </section>
      {episode.attribution && (
        <div className="source-credit">
          <a
            href={episode.attribution.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            {episode.attribution.publisher} · {episode.attribution.author} ↗
          </a>
          <span>{t("节选")}</span>
          <a
            href={episode.attribution.licenseUrl}
            target="_blank"
            rel="noreferrer"
          >
            {t("转载许可")} ↗
          </a>
          {episode.attribution.license.startsWith("CC BY") && (
            <>
              <span>{episode.attribution.license}</span>
              <a
                href={`/api/episodes/${episode.id}/audio`}
                download={`${episode.id}.mp3`}
              >
                {t("下载节选")}
              </a>
              <a
                href={`/api/episodes/${episode.id}`}
                download={`${episode.id}.json`}
              >
                {t("下载转写")}
              </a>
            </>
          )}
        </div>
      )}
      <audio
        key={episode.id}
        ref={audio}
        src={`/api/episodes/${episode.id}/audio`}
        onLoadedMetadata={metadataLoaded}
        onTimeUpdate={audioTick}
        onEnded={stopListening}
      />
      <div className="mobile-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={mobileTab === "transcript"}
          className={mobileTab === "transcript" ? "active" : ""}
          onClick={() => setMobileTab("transcript")}
        >
          {t("节目逐字稿")}
        </button>
        <button
          role="tab"
          aria-selected={mobileTab === "chat"}
          className={mobileTab === "chat" ? "active" : ""}
          onClick={() => setMobileTab("chat")}
        >
          {t("聊两句")}
        </button>
      </div>
      <div className="lower">
        <section
          className="transcript"
          data-active={mobileTab === "transcript" || undefined}
        >
          <Transcript
            key={episode.id}
            passages={episode.analysis?.passages ?? []}
            positionMs={state.positionMs}
            onSeek={(atMs) => {
              seek(atMs);
              startListening();
            }}
          />
          {state.interruption && (
            <div className="return-note">
              <span>
                {t("↶ 聊完从这里继续 ·")}
                {formatPlayerTime(state.interruption.resumeMs)}
              </span>
              {returnContext && (
                <p className="return-context">
                  {t("刚才听到：")}
                  {returnContext}
                </p>
              )}
              <p>
                {
                  episode.analysis?.anchors.find(
                    (a) => a.id === state.interruption?.anchorId,
                  )?.text
                }
              </p>
            </div>
          )}
        </section>
        <section
          className="conversation"
          data-active={mobileTab === "chat" || undefined}
        >
          <div className="panel-heading">
            <h2>{t("聊两句")}</h2>
            <span
              role="status"
              className={liveStatus !== "off" ? "mic active" : "mic"}
            >
              {{
                off: t("麦克风未监听"),
                arming: t("开启麦克风…"),
                armed:
                  listeningMode === "manual"
                    ? t("按住说话 · 待命")
                    : t("● 本地监听"),
                connecting: t("● 正在连接"),
                transcribing: t("● 正在识别"),
                on:
                  listeningMode === "manual"
                    ? t("按住说话 · 可继续追问")
                    : t("● 语音交流中"),
                closing: t("● 本地监听"),
              }[liveStatus] ?? t("麦克风未监听")}
            </span>
          </div>
          <div
            className="messages"
            ref={messages}
            role="log"
            aria-label={t("对话记录")}
          >
            {!history.length ? (
              <div className="empty-chat">
                <div className="waveform" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <p>
                  {t("不懂的概念，突然的好奇。")}
                  <br />
                  {t("都可以在这里聊。")}
                </p>
                <small>
                  {configured
                    ? listeningMode === "auto"
                      ? t("播放时自动监听，直接开口就能打断；暂停后停止监听。")
                      : listeningMode === "manual"
                        ? t("按住下方按钮说话，松开后回答。")
                        : t("安心听节目，有问题也可以打字问。")
                    : t("配置服务端 API key 后可语音或文字提问。")}
                </small>
              </div>
            ) : (
              history.map((turn, i) => (
                <div key={i} className={`message ${turn.role}`}>
                  <small>{turn.role === "user" ? t("你") : "ASIDE"}</small>
                  <p>{turn.text}</p>
                </div>
              ))
            )}
            {busy && (
              <div className="busy">
                {t("正在找相关材料")}
                <span>…</span>
              </div>
            )}
          </div>
          {state.interruption && (
            <div className="followup-window">
              <span>
                {resumeSeconds !== null
                  ? resumeLabel(resumeSeconds)
                  : resumeHeld || followupMs === 0
                    ? t("准备好了，再继续听")
                    : busy
                      ? t("聊完再接着听")
                      : t("可以追问，或继续听")}
              </span>
              {!resumeHeld && (
                <button onClick={holdResume}>{t("先别继续")}</button>
              )}
            </div>
          )}
          {listeningMode === "manual" && (
            <button
              className={`push-to-talk${manualHeld ? " recording" : ""}`}
              disabled={!configured || !episode.analysis}
              aria-label={t("按住说话")}
              aria-pressed={manualHeld}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                e.currentTarget.focus();
                e.currentTarget.setPointerCapture(e.pointerId);
                void beginManual();
              }}
              onPointerUp={endManual}
              onPointerCancel={endManual}
              onLostPointerCapture={endManual}
              onBlur={endManual}
              onContextMenu={(e) => e.preventDefault()}
              onKeyDown={(e) => {
                if ((e.code === "Space" || e.code === "Enter") && !e.repeat) {
                  e.preventDefault();
                  void beginManual();
                }
              }}
              onKeyUp={(e) => {
                if (e.code === "Space" || e.code === "Enter") {
                  e.preventDefault();
                  endManual();
                }
              }}
            >
              {manualHeld
                ? liveStatus === "arming"
                  ? t("开启麦克风…就绪后说话")
                  : t("正在录音 · 松开发送")
                : t("按住说话")}
            </button>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setMobileTab("chat");
              submitQuestion();
            }}
          >
            <input
              aria-label={t("输入问题")}
              placeholder={t("也可以打字问问…")}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <button
              disabled={!configured || !episode.analysis || !question.trim()}
              aria-label={t("发送问题")}
            >
              ↑
            </button>
          </form>
          {sources.length > 0 && (
            <details>
              <summary>
                {t("参考材料 ·")}
                {sources.length}
              </summary>
              {sources.map((s, i) => (
                <p key={i}>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.text}
                    </a>
                  ) : (
                    `${formatPlayerTime(s.startMs ?? 0)} ${s.text}`
                  )}
                </p>
              ))}
            </details>
          )}
        </section>
      </div>
      <div className="player-dock" aria-label={t("播放控制")}>
        <div className="dock-title" title={episode.title}>
          <span
            className={`dock-art${listeningActive ? " playing" : ""}`}
            aria-hidden="true"
          >
            <i />
            <i />
            <i />
            <i />
          </span>
          <strong>{episode.title}</strong>
        </div>
        <div className="dock-transport">
          <div className="dock-progress">
            <span>{formatPlayerTime(state.positionMs)}</span>
            <div className="timeline-wrap">
              <input
                aria-label={t("播放进度")}
                className="timeline"
                type="range"
                min={0}
                max={episode.durationMs}
                value={state.positionMs}
                onChange={(e) => seek(Number(e.target.value))}
              />
              {episode.durationMs > 0 &&
                (episode.analysis?.anchors ?? []).map((a) => (
                  <i
                    key={a.id}
                    className="timeline-anchor"
                    style={{
                      left: `${(a.startMs / episode.durationMs) * 100}%`,
                    }}
                    title={a.text}
                  />
                ))}
              {state.interruption && episode.durationMs > 0 && (
                <i
                  className="timeline-resume"
                  style={{
                    left: `${(state.interruption.resumeMs / episode.durationMs) * 100}%`,
                  }}
                  title={t("从这里继续听")}
                />
              )}
            </div>
            <span>{formatPlayerTime(episode.durationMs)}</span>
          </div>
          <div className="controls">
            <button
              className={`play${listeningActive ? " playing" : ""}`}
              aria-keyshortcuts="Space"
              title={t("播放 / 暂停（空格）")}
              aria-label={listeningActive ? t("暂停") : t("播放")}
              onClick={listeningActive ? stopListening : startListening}
            >
              {listeningActive ? (
                <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                  <rect x="3" y="2" width="3.4" height="12" rx="1" fill="currentColor" />
                  <rect x="9.6" y="2" width="3.4" height="12" rx="1" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                  <path
                    d="M4.5 2.3c0-1 1.1-1.6 2-1.1l7.5 4.7c.8.5.8 1.7 0 2.2l-7.5 4.7c-.9.5-2-.1-2-1.1z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </button>
            {state.interruption && (
              <button className="resume" onClick={requestResume}>
                {t("继续听 ↗")}
              </button>
            )}
          </div>
        </div>
        <select
          aria-label={t("播放速度")}
          defaultValue="1"
          onChange={(e) => setPlaybackRate(Number(e.target.value))}
        >
          <option value="0.75">0.75×</option>
          <option value="1">1×</option>
          <option value="1.25">1.25×</option>
          <option value="1.5">1.5×</option>
        </select>
      </div>
      <button
        className="debug-toggle"
        hidden={!debugAllowed}
        onClick={() => setDebug(!debug)}
      >
        {t("开发观察")}
        {debug ? "−" : "+"}
      </button>
      {debugAllowed && debug && (
        <pre className="debug">
          {JSON.stringify(
            {
              state,
              voiceReason: episode.analysis?.voiceReason,
              responseLatencies: latencies,
              events,
            },
            null,
            2,
          )}
        </pre>
      )}
      <footer className="player-footer">
        ASIDE <span>{t("随时聊两句，再接着听。")}</span>
      </footer>
    </main>
  );
}
