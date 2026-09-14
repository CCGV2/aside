import { LibraryDrawer } from "./LibraryDrawer";
import { audioCard, libraryFor } from "./library-item";
import { Landing } from "./Landing";
import { AccountControl } from "./AccountControl";
import { Space } from "./Space";
import { PlayerView } from "./PlayerView";
import { t, useLocale, message } from "./i18n";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { usePlayerController } from "./usePlayerController";
import "./style.css";
function App() {
  const locale = useLocale();
  const player = usePlayerController();
  const {
    episodes,
    episodesLoading,
    episode,
    error,
    setError,
    load,
    enter,
    playEpisode,
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
  if (location.pathname === "/space")
    return (
      <Space
        publicHref={
          episodes[0] ? `/?episode=${encodeURIComponent(episodes[0].id)}` : "/"
        }
        accountControl={<AccountControl onAuthChanged={accountUpdated} />}
        accountVersion={accountVersion}
        activeEpisodeId={episode?.id}
        player={
          episode
            ? (navigation) => (
                <PlayerView
                  player={player}
                  onAuthChanged={accountUpdated}
                  navigation={navigation}
                />
              )
            : undefined
        }
        onOpen={(id, userInitiated = true) => {
          window.history.replaceState(
            null,
            "",
            `/space?episode=${encodeURIComponent(id)}`,
          );
          void (userInitiated ? playEpisode(id) : load(id)).catch((cause) =>
            setError(cause.message),
          );
        }}
      />
    );

  if (!episode)
    return (
      <Landing
        episodes={episodes}
        loading={episodesLoading}
        error={message(error)}
        spaceLink={!!accountUser}
        accountControl={
          <AccountControl onAuthChanged={accountUpdated} enterSpace />
        }
        open={(id) => void enter(id).catch((error) => setError(error.message))}
      />
    );

  return (
    <div className="shell without-sidebar">
      <PlayerView
        player={player}
        onAuthChanged={accountUpdated}
        navigation={
          <>
            <a className="brand" href="/" aria-label="Aside">
              <span className="brand-word">Aside</span>
              <img
                className="brand-mark"
                src="/aside-mark.svg"
                alt=""
                aria-hidden="true"
              />
            </a>
            <LibraryDrawer
              collection="public"
              items={libraryFor(episodes, locale).map(audioCard)}
              label={t("公共音频库")}
              onOpen={(id) =>
                void playEpisode(id).catch((error) => setError(error.message))
              }
            />
          </>
        }
      />
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
