import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Episode } from "@aside/engine/core";
import { MAX_AUDIO_DURATION_MS, MAX_UPLOAD_BYTES } from "@aside/engine/core";
import { episodeLibrary, type SpacePage } from "./player-api";
import { message, t } from "./i18n";
import { LanguageSelect } from "./LanguageSelect";
import "./space.css";

interface SpaceUser {
  id: string;
  alias: string;
  description: string;
  avatarUrl: string | null;
}
const formatDuration = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};
const formatSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
const fileTitle = (name: string) => (name.replace(/\.[^.]+$/, "").trim() || name).slice(0, 200);

function inspectDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 8000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () =>
      finish(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : null);
    audio.onerror = () => finish(null);
    audio.src = url;
  });
}

export function Space({
  accountControl,
  accountVersion,
  onOpen,
  activeEpisodeId,
  player,
}: {
  accountControl: ReactNode;
  accountVersion: number;
  onOpen: (id: string, userInitiated?: boolean) => void;
  activeEpisodeId?: string;
  player?: ReactNode;
}) {
  const [user, setUser] = useState<SpaceUser | null>();
  const [page, setPage] = useState<SpacePage>();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [phase, setPhase] = useState<"uploading" | "processing">("uploading");
  const [checking, setChecking] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [activeUploadId, setActiveUploadId] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [uploadEnabled, setUploadEnabled] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const uploadBusy = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const loadedPages = useRef(1);
  const refreshVersion = useRef(0);

  async function refresh() {
    const version = ++refreshVersion.current;
    const first = await episodeLibrary.space();
    let last = first;
    const items = [...first.episodes];
    for (let index = 1; index < loadedPages.current && last.nextCursor; index++) {
      last = await episodeLibrary.space(last.nextCursor);
      items.push(...last.episodes);
    }
    if (version !== refreshVersion.current) return;
    setPage({ ...first, nextCursor: last.nextCursor });
    setEpisodes(items);
  }
  useEffect(() => {
    void episodeLibrary.health().then((health) => setUploadEnabled(health.uploadsEnabled === true)).catch(() => {});
  }, []);
  useEffect(() => {
    let active = true;
    loadedPages.current = 1;
    refreshVersion.current++;
    void fetch("/api/auth/session")
      .then((response) => response.json())
      .then(async (session: { user: SpaceUser | null }) => {
        if (!active) return;
        setUser(session.user);
        if (session.user) await refresh();
        else { setPage(undefined); setEpisodes([]); }
      })
      .catch(() => active && setError(t("请求失败，请重试")));
    return () => { active = false; };
  }, [accountVersion]);
  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => void refresh().catch(() => {}), 5000);
    return () => clearInterval(timer);
  }, [user?.id]);
  useEffect(() => {
    if (!user || !page || player || new URLSearchParams(location.search).has("episode")) return;
    const first = episodes.find((item) => item.durationMs > 0 && item.status !== "blocked");
    if (first) onOpen(first.id, false);
  }, [user?.id, page, episodes, player]);

  async function choose(file?: File) {
    if (!file || uploadBusy.current) return;
    uploadBusy.current = true;
    setError("");
    setUploadName(file.name);
    setChecking(true);
    let started = false;
    try {
      if (file.size < 44 || file.size > MAX_UPLOAD_BYTES) throw Error(t("音频文件需小于 1 GiB"));
      const length = await inspectDuration(file);
      if (length !== null && length > MAX_AUDIO_DURATION_MS) throw Error(t("单个音频不能超过 5 小时"));
      setChecking(false);
      const abort = new AbortController();
      controller.current = abort;
      setProgress(0);
      setPhase("uploading");
      started = true;
      await episodeLibrary.upload(file, {
        title: fileTitle(file.name),
        signal: abort.signal,
        onStarted: setActiveUploadId,
        onProgress: (bytes, total, nextPhase) => {
          setProgress(Math.round((bytes / total) * 100));
          setPhase(nextPhase);
        },
      });
      await refresh();
    } catch (cause) {
      setError(controller.current?.signal.aborted ? t("上传已取消") : message(cause instanceof Error ? cause.message : String(cause)));
      if (started) await refresh().catch(() => {});
    } finally {
      controller.current = null;
      uploadBusy.current = false;
      setChecking(false);
      setProgress(null);
      setActiveUploadId("");
      setUploadName("");
    }
  }
  async function act(id: string, action: "retry" | "delete" | "cancel") {
    if (action === "delete" && !window.confirm(t("确定删除这篇音频及其分析结果吗？"))) return;
    setBusyId(id);
    setError("");
    try {
      if (action === "retry") await episodeLibrary.retry(id);
      if (action === "delete") await episodeLibrary.delete(id);
      if (action === "cancel") await episodeLibrary.cancelUpload(id);
      if (action === "delete" && activeEpisodeId === id) {
        location.href = "/space";
        return;
      }
      await refresh();
    } catch (cause) {
      setError(message(cause instanceof Error ? cause.message : String(cause)));
    } finally { setBusyId(""); }
  }
  async function more() {
    if (!page?.nextCursor || loadingMore) return;
    loadedPages.current++;
    setLoadingMore(true);
    try {
      await refresh();
    } catch (cause) {
      loadedPages.current--;
      throw cause;
    } finally {
      setLoadingMore(false);
    }
  }

  return <div className={`space-page${player ? " shell is-playing" : ""}`}>
    <aside className={`space-sidebar${player ? " sidebar" : ""}`}>
      <a className="brand" href="/" aria-label="Aside">aside<span>◖</span></a>
      <p className="space-sidebar-tagline">{t("好问题，不必等到最后。")}</p>
      {user && <>
        <button
          type="button"
          className="space-sidebar-upload"
          disabled={!uploadEnabled || !page || checking || progress !== null || page.usedToday >= page.dailyLimit || page.usedStorage >= page.storageLimit}
          onClick={() => input.current?.click()}
          aria-describedby="space-upload-limit"
        >＋ {t("上传音频")}</button>
        <input
          ref={input}
          type="file"
          accept="audio/*,.mp4"
          aria-label={t("选择音频")}
          className="space-sidebar-file"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            void choose(file);
          }}
        />
        <p id="space-upload-limit" className="space-sidebar-limit">
          {page ? `${page.usedToday} / ${page.dailyLimit} ${t("篇今日已用")}` : t("正在加载…")}
          <span>{t("单个音频最长 5 小时 · 文件最大 1 GiB · 每天最多 5 篇")}</span>
        </p>
        {!uploadEnabled && <p className="space-sidebar-note">{t("上传暂未开放，已保存的音频仍可收听。")}</p>}
        {(checking || progress !== null) && <div className="space-upload-activity" role="status">
          <strong>{uploadName}</strong>
          <small>{checking ? t("正在检查音频") : phase === "processing" ? t("上传完成，正在启动自动分析…") : `${progress}%`}</small>
          {progress !== null && <div className="space-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>}
          {progress !== null && phase === "uploading" && <button type="button" onClick={() => controller.current?.abort()}>{t("取消上传")}</button>}
        </div>}
        {error && <div role="alert" className="space-sidebar-alert">{error}<button type="button" onClick={() => setError("")} aria-label={t("关闭")}>×</button></div>}
        <div className="space-sidebar-heading"><h2 id="space-library-title">{t("我的音频")}</h2><span>{episodes.length}{page?.nextCursor ? "+" : ""}</span></div>
        <nav className="space-sidebar-list" aria-labelledby="space-library-title">
          {page?.pending.filter((item) => item.id !== activeUploadId).map((item) => <article className="space-card" key={item.id}>
            <div className="space-card-body"><span className="space-card-icon">↥</span><div className="space-card-copy"><strong>{item.title}</strong><small>{formatSize(item.size)} · {t("上传中断，可取消后重新上传")}</small></div></div>
            <div className="space-card-actions"><button disabled={busyId === item.id} onClick={() => void act(item.id, "cancel")}>{t("取消")}</button></div>
          </article>)}
          {episodes.map((item) => <article className={`space-card${activeEpisodeId === item.id ? " selected" : ""}`} key={item.id}>
            {item.durationMs > 0 && item.status !== "blocked" ? <button className="space-card-open" onClick={() => onOpen(item.id)} aria-label={`${t("继续听")} ${item.title}`} aria-current={activeEpisodeId === item.id ? "page" : undefined}><span className="space-card-icon">♫</span><span className="space-card-copy"><strong>{item.title}</strong><small>{formatDuration(item.durationMs)} · {item.status === "ready" ? t("可对话") : message(item.stage)}</small></span></button> : <div className="space-card-body"><span className="space-card-icon">♫</span><div className="space-card-copy"><strong>{item.title}</strong><small>{item.durationMs ? formatDuration(item.durationMs) : t("正在检查音频")} · {item.status === "blocked" ? message(item.error || item.stage) : message(item.stage)}</small></div></div>}
            {item.status === "analyzing" && <div className="space-progress"><span style={{ width: `${Math.round(item.progress * 100)}%` }} /></div>}
            <div className="space-card-actions">{item.status === "failed" && <button disabled={busyId === item.id} onClick={() => void act(item.id, "retry")}>{t("重试分析")}</button>}<button disabled={busyId === item.id} onClick={() => void act(item.id, "delete")}>{t("删除")}</button></div>
          </article>)}
          {page && !page.pending.length && !episodes.length && <p className="space-sidebar-empty">{t("这里还没有音频")}<br />{t("上传后会自动分析，无需再点开始。")}</p>}
          {page?.nextCursor && <button className="space-more" disabled={loadingMore} onClick={() => void more().catch((cause) => setError(message(cause.message)))}>{t("加载更多")}</button>}
        </nav>
      </>}
      <a className="space-sidebar-explore" href="/">{t("探索")} ↗</a>
    </aside>
    {player || <main className="space-main">
      <header className="space-nav"><span>ASIDE / YOUR SPACE</span><div className="space-nav-actions"><a href="/">{t("探索")}</a><LanguageSelect />{accountControl}</div></header>
      {!user && error && <div role="alert" className="space-alert">{error}<button onClick={() => setError("")} aria-label={t("关闭")}>×</button></div>}
      {user === undefined ? <p>{t("正在加载…")}</p> : !user ?
        <section className="space-empty"><h2>{t("登录后，把想听的音频放在这里。")}</h2><p>{t("请从右上角登录，随时回来继续收听。")}</p></section>
      : <section className="space-stage-empty"><h1>{t("我的空间")}</h1><p>{t("从左侧选择音频开始收听")}</p></section>}
    </main>}
  </div>;
}
