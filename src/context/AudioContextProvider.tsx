"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

interface AudioContextValue {
  audioEnabled: boolean;
  hasEntered: boolean;
  /** The entry screen is gone and the scroll lock it held has been released.
   *  `hasEntered` flips the instant Enter is pressed, while the entry screen's
   *  own exit flight still holds the page's scroll locked for a further
   *  SPIN_MS + ESCAPE_MS - anything that measures itself against scroll
   *  position needs this, not `hasEntered`, or it sets up while the page is
   *  still scroll-locked underneath it. */
  entryComplete: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  enterPortfolio: () => void;
  markEntryComplete: () => void;
}

const AudioContext = createContext<AudioContextValue>({
  audioEnabled: false,
  hasEntered: false,
  entryComplete: false,
  setAudioEnabled: () => {},
  enterPortfolio: () => {},
  markEntryComplete: () => {},
});

export const useAudio = () => useContext(AudioContext);

export const AudioProvider = ({ children }: { children: React.ReactNode }) => {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [entryComplete, setEntryComplete] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

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
    setAudioEnabled(true);
  };

  const markEntryComplete = useCallback(() => {
    setEntryComplete(true);
  }, []);

  return (
    <AudioContext.Provider
      value={{ audioEnabled, hasEntered, entryComplete, setAudioEnabled, enterPortfolio, markEntryComplete }}
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
