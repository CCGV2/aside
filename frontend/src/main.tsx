import { Landing } from "./Landing";
import { AccountControl } from "./AccountControl";
import { Space } from "./Space";
import { PlayerView, formatPlayerTime } from "./PlayerView";
import { t, useLocale, message } from "./i18n";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { usePlayerController } from "./usePlayerController";
import "./style.css";
function App() {
  useLocale();
  const player = usePlayerController();
  const {
    episodes,
    episode,
    error,
    configured,
    setError,
    load,
    enter,
    authChanged,
  } = player;
  const [accountUser, setAccountUser] = useState<{ id: string } | null>(null);
  const [accountVersion, setAccountVersion] = useState(0);
  useEffect(() => {
    if (episode) window.scrollTo(0, 0);
  }, [episode?.id]);
  useEffect(() => {
    void fetch("/api/auth/session")
      .then((response) => response.json())
      .then((data: { user: { id: string } | null }) =>
        setAccountUser(data.user),
      )
      .catch(() => {});
    const selected = new URLSearchParams(location.search).get("episode");
    if (selected && /^[a-zA-Z0-9-]+$/.test(selected)) {
      if (location.pathname !== "/space")
        window.history.replaceState(null, "", "/");
      void load(selected).catch((cause) => setError(cause.message));
    }
  }, []);
  async function accountUpdated() {
    await authChanged();
    const response = await fetch("/api/auth/session");
    const data = (await response.json()) as { user: { id: string } | null };
    setAccountUser(data.user);
    setAccountVersion((version) => version + 1);
  }
  const playerMain = episode ? (
    <PlayerView player={player} onAuthChanged={accountUpdated} />
  ) : null;
  if (location.pathname === "/space")
    return (
      <Space
        accountControl={<AccountControl onAuthChanged={accountUpdated} />}
        accountVersion={accountVersion}
        activeEpisodeId={episode?.id}
        player={playerMain}
        onOpen={(id, userInitiated = true) => {
          window.history.replaceState(
            null,
            "",
            `/space?episode=${encodeURIComponent(id)}`,
          );
          void (userInitiated ? enter(id) : load(id)).catch((cause) =>
            setError(cause.message),
          );
        }}
      />
    );

  if (!episode)
    return (
      <Landing
        episodes={episodes}
        error={message(error)}
        spaceLink={!!accountUser}
        accountControl={<AccountControl onAuthChanged={accountUpdated} />}
        open={(id) => void enter(id).catch((error) => setError(error.message))}
      />
    );

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          aside<span>◖</span>
        </a>
        <p className="tagline">{t("好问题，不必等到最后。")}</p>
        {accountUser && (
          <a className="upload" href="/space">
            {t("我的空间")}
          </a>
        )}
        <div className="section-label">
          {t("我的收听")}
          <span>{episodes.length}</span>
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
                  {formatPlayerTime(e.durationMs)} ·{" "}
                  {e.status === "ready" ? t("可以收听") : message(e.stage)}
                </small>
              </span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className={`dot ${configured ? "green" : ""}`} />
          {configured ? t("语音服务已配置") : t("本地模式 · 语音服务待配置")}
          <small>{t("耳机听，更自在。")}</small>
        </div>
      </aside>
      {playerMain}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
