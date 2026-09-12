import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Episode } from "@aside/engine/core";
import { ListeningSession, type ListeningMode } from "./listening-session";
import { BrowserPodcastAudio } from "./podcast-audio";
import { episodeLibrary, playerBackend } from "./player-api";
export const names = {
  paused: "已暂停",
  playing: "正在播放",
  listening: "正在听你说",
  answering: "正在回答",
  awaiting_followup: "还想聊聊吗",
  resuming: "回到节目",
  reconnecting: "连接已断开",
};
function preference(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function savePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
/** React owns the library view; the session owns all listening and question actions. */
export function usePlayerController() {
  const [runtime] = useState(() => {
    const audio = new BrowserPodcastAudio();
    const mode = preference("aside.listeningMode");
    const savedWait = preference("aside.followupMs");
    const session = new ListeningSession(audio, playerBackend, {
      mode: mode === "manual" || mode === "off" ? mode : "auto",
      followupMs:
        savedWait !== null && [0, 3000, 8000].includes(Number(savedWait))
          ? Number(savedWait)
          : undefined,
    });
    return { audio, session };
  });
  const { session, audio } = runtime;
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episode, setEpisode] = useState<Episode>();
  const [uploading, setUploading] = useState(false);
  const [debug, setDebug] = useState(false);
  const selected = useRef<Episode | undefined>(undefined);
  const loadVersion = useRef(0);
  const refresh = async () => {
    setEpisodes(await episodeLibrary.list());
  };
  async function load(id: string) {
    session.stop();
    const version = ++loadVersion.current;
    const [next, checkpoint] = await Promise.all([
      episodeLibrary.get(id),
      episodeLibrary.checkpoint(id),
    ]);
    if (version !== loadVersion.current) return;
    selected.current = next;
    session.load(next, checkpoint);
    setEpisode(next);
  }
  useEffect(() => {
    let disposed = false;
    void refresh().catch((error) => {
      if (!disposed) session.setError(error.message);
    });
    void episodeLibrary
      .health()
      .then((health) => {
        if (!disposed) session.configure(health);
      })
      .catch((error) => {
        if (!disposed) session.setError(error.message);
      });
    const pagehide = () => session.stop();
    window.addEventListener("pagehide", pagehide);
    const poll = window.setInterval(() => {
      void episodeLibrary
        .list()
        .then((list) => {
          if (!disposed) setEpisodes(list);
        })
        .catch(() => {});
      const current = selected.current;
      if (current && current.status !== "ready")
        void episodeLibrary
          .get(current.id)
          .then((next) => {
            if (disposed || selected.current?.id !== next.id) return;
            selected.current = next;
            session.updateEpisode(next);
            setEpisode(next);
          })
          .catch(() => {});
    }, 2500);
    const checkpoint = window.setInterval(() => {
      if (selected.current)
        void episodeLibrary
          .save(selected.current.id, session.checkpoint())
          .catch(() => {});
    }, 2000);
    return () => {
      disposed = true;
      loadVersion.current++;
      clearInterval(poll);
      clearInterval(checkpoint);
      window.removeEventListener("pagehide", pagehide);
      session.dispose();
    };
  }, [session]);
  return {
    ...snapshot,
    episodes,
    episode,
    uploading,
    debug,
    setDebug,
    audio: audio.attach,
    metadataLoaded: () => session.metadataLoaded(),
    audioTick: () => session.audioTick(),
    setPlaybackRate: (rate: number) => session.setPlaybackRate(rate),
    seek: (atMs: number) => session.seek(atMs),
    submitQuestion: () =>
      session.submitQuestion(session.getSnapshot().question),
    setQuestion: (text: string) => session.setQuestion(text),
    setError: (error: string) => session.setError(error),
    startListening: () => session.start(),
    stopListening: () => session.stop(),
    requestResume: () => session.start(),
    beginManual: () => session.beginManual(),
    endManual: () => session.endManual(),
    holdResume: () => session.holdResume(),
    changeListeningMode: (mode: ListeningMode) => {
      savePreference("aside.listeningMode", mode);
      session.setListeningMode(mode);
    },
    changeFollowupMs: (delay: number) => {
      savePreference("aside.followupMs", String(delay));
      session.setFollowupMs(delay);
    },
    load,
    async upload(file?: File) {
      if (!file) return;
      setUploading(true);
      session.setError("");
      try {
        const next = await episodeLibrary.upload(file);
        await refresh();
        await load(next.id);
      } catch (error) {
        session.setError(
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setUploading(false);
      }
    },
    async retry() {
      if (selected.current) {
        await episodeLibrary.retry(selected.current.id);
        await load(selected.current.id);
      }
    },
  };
}
