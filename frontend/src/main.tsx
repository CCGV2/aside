import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Transcript } from "./Transcript";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { usePlayerController, names } from "./usePlayerController";
import "./style.css";
const time = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
function App() {
  const {
    listeningMode,
    changeListeningMode,
    manualHeld,
    beginManual,
    endManual,
    followupMs,
    changeFollowupMs,
    resumeSeconds,
    resumeHeld,
    holdResume,
    returnContext,
    latencies,
    episodes,
    episode,
    state,
    history,
    error,
    configured,
    uploading,
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
    upload,
    load,
    requestResume,
    listeningActive,
    startListening,
    stopListening,
    retry,
  } = usePlayerController();
  const [compactEpisode, setCompactEpisode] = useState("");
  const compact = !!episode && compactEpisode === episode.id;
  const layoutTransition = useRef<ViewTransition | undefined>(undefined);
  useEffect(() => {
    const target = listeningActive && episode ? episode.id : "";
    if (target === compactEpisode) return;
    layoutTransition.current?.skipTransition();
    const update = () => setCompactEpisode(target);
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

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          aside<span>◖</span>
        </a>
        <p className="tagline">好问题，不必等到最后。</p>
        <label className="upload">
          <span>＋ 导入播客</span>
          <input
            type="file"
            accept="audio/*,.mp4"
            disabled={uploading}
            onChange={(e) => void upload(e.target.files?.[0])}
          />
        </label>
        <div className="section-label">
          我的收听 <span>{episodes.length}</span>
        </div>
        <nav>
          {episodes.map((e) => (
            <button
              className={`episode ${episode?.id === e.id ? "selected" : ""}`}
              key={e.id}
              onClick={() => void load(e.id).catch((e) => setError(e.message))}
            >
              <span className="episode-icon">≋</span>
              <span>
                <strong>{e.title}</strong>
                <small>
                  {time(e.durationMs)} ·{" "}
                  {e.status === "ready" ? "可以收听" : e.stage}
                </small>
              </span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className={`dot ${configured ? "green" : ""}`} />
          {configured ? "语音服务已配置" : "本地模式 · 语音服务待配置"}
          <small>耳机听，更自在。</small>
        </div>
      </aside>
      <main className={compact ? "listening-layout" : undefined}>
        <header>
          <span>你的播客，留一点对话的空间</span>
          <span className="local">LOCAL WORKSPACE</span>
        </header>
        {error && (
          <div role="alert" className="alert">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}
        {!episode ? (
          <section className="welcome">
            <div className="eyebrow">LISTEN. WONDER. ASK.</div>
            <h1>
              听到这里，
              <br />
              刚好有个问题。
            </h1>
            <p>
              带来一期播客。随时开口，聊清楚，
              <br />
              再从刚才那句话继续。
            </p>
            <label
              className="drop"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void upload(e.dataTransfer.files[0]);
              }}
            >
              <span className="drop-icon">↥</span>
              <strong>
                {uploading ? "正在导入…" : "拖入音频，或者点击选择"}
              </strong>
              <small>MP3、M4A、WAV 等音频 · 最大 500 MB</small>
              <input
                type="file"
                accept="audio/*,.mp4"
                onChange={(e) => void upload(e.target.files?.[0])}
              />
            </label>
            <div className="welcome-note">
              <span>01 自动整理内容</span>
              <span>02 随时插话</span>
              <span>03 自然接着听</span>
            </div>
          </section>
        ) : (
          <>
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
                <em>留白，也是对话。</em>
              </div>
              <div className="player-content">
                <div className="eyebrow">
                  {episode.analysis?.source === "demo"
                    ? "本地演示 · 合成音频 / 预设分段"
                    : "正在收听"}
                </div>
                <h1>{episode.title}</h1>
                <p className="description">
                  {episode.analysis
                    ? episode.analysis.summary.slice(0, 130)
                    : episode.stage}
                </p>
                {episode.status !== "ready" && (
                  <>
                    <progress max={1} value={episode.progress} />
                    <p>{episode.error}</p>
                    {["blocked", "failed"].includes(episode.status) && (
                      <button
                        onClick={() =>
                          void retry().catch((e) => setError(e.message))
                        }
                      >
                        重新分析
                      </button>
                    )}
                  </>
                )}
                <div className="status">
                  <span
                    className={`dot ${state.mode === "playing" ? "green" : ""}`}
                  />
                  {names[state.mode]}
                  {episode.analysis && (
                    <span className="voice-label">
                      {episode.analysis.voice === "feminine" ? "女声" : "男声"}{" "}
                      · 自动匹配
                    </span>
                  )}
                </div>
                <input
                  aria-label="播放进度"
                  className="timeline"
                  type="range"
                  min={0}
                  max={episode.durationMs}
                  value={state.positionMs}
                  onChange={(e) => seek(Number(e.target.value))}
                />
                <div className="time-row">
                  <span>{time(state.positionMs)}</span>
                  <span>{time(episode.durationMs)}</span>
                </div>
                <div className="controls">
                  <button
                    className="play"
                    aria-keyshortcuts="Space"
                    title="播放 / 暂停（空格）"
                    aria-label={listeningActive ? "暂停" : "播放"}
                    onClick={listeningActive ? stopListening : startListening}
                  >
                    {listeningActive ? "Ⅱ" : "▶"}
                  </button>
                  {state.interruption && (
                    <button className="resume" onClick={requestResume}>
                      继续听 ↗
                    </button>
                  )}
                  <select
                    aria-label="播放速度"
                    defaultValue="1"
                    onChange={(e) => setPlaybackRate(Number(e.target.value))}
                  >
                    <option value="0.75">0.75×</option>
                    <option value="1">1×</option>
                    <option value="1.25">1.25×</option>
                    <option value="1.5">1.5×</option>
                  </select>
                </div>
              </div>
            </section>
            <audio
              key={episode.id}
              ref={audio}
              src={`/api/episodes/${episode.id}/audio`}
              onLoadedMetadata={metadataLoaded}
              onTimeUpdate={audioTick}
              onEnded={stopListening}
            />
            <div className="listening-options" aria-label="收听设置">
              <label>
                插话方式
                <select
                  aria-label="插话方式"
                  value={listeningMode}
                  onChange={(e) =>
                    changeListeningMode(e.target.value as typeof listeningMode)
                  }
                >
                  <option value="auto">自动插话</option>
                  <option value="manual">按住说话</option>
                  <option value="off">只听节目</option>
                </select>
              </label>
              <label>
                回答后继续
                <select
                  aria-label="回答后继续"
                  value={followupMs}
                  onChange={(e) => changeFollowupMs(Number(e.target.value))}
                >
                  {![0, 3000, 8000].includes(followupMs) && (
                    <option value={followupMs}>跟随服务设置</option>
                  )}
                  <option value="3000">等 3 秒</option>
                  <option value="8000">等 8 秒</option>
                  <option value="0">手动继续</option>
                </select>
              </label>
              <small>
                {listeningMode === "auto"
                  ? "播放时本地监听，开口即可插话"
                  : listeningMode === "manual"
                    ? "按住录音，松开发送；也可按住空格键操作按钮"
                    : "麦克风关闭，仍可打字提问"}
              </small>
            </div>
            <div className="lower">
              <section className="transcript">
                <Transcript
                  key={episode.id}
                  passages={episode.analysis?.passages ?? []}
                  positionMs={state.positionMs}
                />
                {state.interruption && (
                  <div className="return-note">
                    <span>
                      ↶ 聊完从这里继续 · {time(state.interruption.resumeMs)}
                    </span>
                    {returnContext && (
                      <p className="return-context">
                        刚才听到：{returnContext}
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
              <section className="conversation">
                <div className="panel-heading">
                  <h2>聊两句</h2>
                  <span
                    role="status"
                    className={liveStatus !== "off" ? "mic active" : "mic"}
                  >
                    {{
                      off: "麦克风未监听",
                      arming: "开启麦克风…",
                      armed:
                        listeningMode === "manual"
                          ? "按住说话 · 待命"
                          : "● 本地监听",
                      connecting: "● 正在连接",
                      transcribing: "● 正在识别",
                      on:
                        listeningMode === "manual"
                          ? "按住说话 · 可继续追问"
                          : "● 语音交流中",
                      closing: "● 本地监听",
                    }[liveStatus] ?? "麦克风未监听"}
                  </span>
                </div>
                <div
                  className="messages"
                  ref={messages}
                  role="log"
                  aria-label="对话记录"
                >
                  {!history.length ? (
                    <div className="empty-chat">
                      <span>“</span>
                      <p>
                        不懂的概念，突然的好奇。
                        <br />
                        都可以在这里聊。
                      </p>
                      <small>
                        {configured
                          ? listeningMode === "auto"
                            ? "播放时自动监听，直接开口就能打断；暂停后停止监听。"
                            : listeningMode === "manual"
                              ? "按住下方按钮说话，松开后回答。"
                              : "安心听节目，有问题也可以打字问。"
                          : "配置服务端 API key 后可语音或文字提问。"}
                      </small>
                    </div>
                  ) : (
                    history.map((t, i) => (
                      <div key={i} className={`message ${t.role}`}>
                        <small>{t.role === "user" ? "你" : "ASIDE"}</small>
                        <p>{t.text}</p>
                      </div>
                    ))
                  )}
                  {busy && (
                    <div className="busy">
                      正在找相关材料<span>…</span>
                    </div>
                  )}
                </div>
                {state.interruption && (
                  <div className="followup-window">
                    <span>
                      {resumeSeconds !== null
                        ? `${resumeSeconds} 秒后继续播放`
                        : resumeHeld || followupMs === 0
                          ? "准备好了，再继续听"
                          : busy
                            ? "聊完再接着听"
                            : "可以追问，或继续听"}
                    </span>
                    {!resumeHeld && (
                      <button onClick={holdResume}>先别继续</button>
                    )}
                  </div>
                )}
                {listeningMode === "manual" && (
                  <button
                    className={`push-to-talk${manualHeld ? " recording" : ""}`}
                    disabled={!configured || !episode.analysis}
                    aria-label="按住说话"
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
                      if (
                        (e.code === "Space" || e.code === "Enter") &&
                        !e.repeat
                      ) {
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
                        ? "开启麦克风…就绪后说话"
                        : "正在录音 · 松开发送"
                      : "按住说话"}
                  </button>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitQuestion();
                  }}
                >
                  <input
                    aria-label="输入问题"
                    placeholder="也可以打字问问…"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                  />
                  <button
                    disabled={
                      !configured || !episode.analysis || !question.trim()
                    }
                    aria-label="发送问题"
                  >
                    ↑
                  </button>
                </form>
                {sources.length > 0 && (
                  <details>
                    <summary>参考材料 · {sources.length}</summary>
                    {sources.map((s, i) => (
                      <p key={i}>
                        {s.url ? (
                          <a href={s.url} target="_blank" rel="noreferrer">
                            {s.text}
                          </a>
                        ) : (
                          `${time(s.startMs ?? 0)} ${s.text}`
                        )}
                      </p>
                    ))}
                  </details>
                )}
              </section>
            </div>
            <button className="debug-toggle" onClick={() => setDebug(!debug)}>
              开发观察 {debug ? "−" : "+"}
            </button>
            {debug && (
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
          </>
        )}
        <footer>
          ASIDE <span>随时聊两句，再接着听。</span>
        </footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
