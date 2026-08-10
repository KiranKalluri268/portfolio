"use client";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";

interface AudioContextValue {
  audioEnabled: boolean;
  hasEntered: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  enterPortfolio: () => void;
}

const AudioContext = createContext<AudioContextValue>({
  audioEnabled: false,
  hasEntered: false,
  setAudioEnabled: () => {},
  enterPortfolio: () => {},
});

export const useAudio = () => useContext(AudioContext);

export const AudioProvider = ({ children }: { children: React.ReactNode }) => {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
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

  return (
    <AudioContext.Provider value={{ audioEnabled, hasEntered, setAudioEnabled, enterPortfolio }}>
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
