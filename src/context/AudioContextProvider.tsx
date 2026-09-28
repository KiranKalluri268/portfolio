"use client";
import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";

interface AudioContextValue {
  audioEnabled: boolean;
  hasEntered: boolean;
  /** True when the loader was skipped — restored from
   *  sessionStorage rather than completed on this page load.
   *  Anything gated on "did the entry screen actually play" (the hero
   *  greeting) reads this instead of `hasEntered`, since `hasEntered` alone
   *  cannot tell the two apart. */
  entrySkipped: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  enterPortfolio: () => void;
}

const AudioContext = createContext<AudioContextValue>({
  audioEnabled: false,
  hasEntered: false,
  entrySkipped: false,
  setAudioEnabled: () => {},
  enterPortfolio: () => {},
});

export const useAudio = () => useContext(AudioContext);

/** Session-scoped, not persistent: a returning visitor tomorrow should still
 *  see the entry, but clicking through the site today — including back to
 *  Home from the menu — should not replay it every time. */
const ENTERED_KEY = "portfolio:entered";

function readHasEntered() {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(ENTERED_KEY) === "true";
  } catch {
    return false;
  }
}

export const AudioProvider = ({ children }: { children: React.ReactNode }) => {
  const [audioEnabled, setAudioEnabled] = useState(false);
  // Starts false to match the server-rendered markup; synced from
  // sessionStorage in the layout effect below before the first paint, so
  // there is no loader flash for a visitor who already arrived this session.
  const [hasEntered, setHasEntered] = useState(false);
  const [entrySkipped, setEntrySkipped] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Reads sessionStorage, which is not available during render.
  useLayoutEffect(() => {
    if (readHasEntered()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasEntered(true);
      setEntrySkipped(true);
    }
  }, []);

  useEffect(() => {
    const syncPlayback = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (audioEnabled && !document.hidden) audio.play().catch(() => {});
      else audio.pause();
    };

    syncPlayback();
    document.addEventListener("visibilitychange", syncPlayback);
    return () => document.removeEventListener("visibilitychange", syncPlayback);
  }, [audioEnabled]);

  const enterPortfolio = () => {
    setHasEntered(true);
    try {
      window.sessionStorage.setItem(ENTERED_KEY, "true");
    } catch {
      // Storage may be unavailable; the loader will replay next time.
    }
  };

  return (
    <AudioContext.Provider
      value={{ audioEnabled, hasEntered, entrySkipped, setAudioEnabled, enterPortfolio }}
    >
      <audio
        ref={audioRef}
        data-portfolio-audio
        className="hidden"
        src="/audio/final.mp3"
        loop
        preload="auto"
      />
      {children}
    </AudioContext.Provider>
  );
};
