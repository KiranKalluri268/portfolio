"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Where a scene's "what do I do here?" hint goes to be said.
 *
 * Scenes decide when a visitor has stalled and what would help; they used to
 * each draw their own pill for it. Now they publish the line here and TARS, the
 * site guide, says it. A scene only ever withdraws its own line, so one scene
 * unmounting cannot silence another's.
 */

interface Published {
  owner: string;
  text: string;
}

const HintContext = createContext<{
  hint: string | null;
  publish: (owner: string, text: string | null) => void;
}>({ hint: null, publish: () => {} });

export function HintProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Published | null>(null);

  const publish = useCallback((owner: string, text: string | null) => {
    setCurrent((previous) => {
      if (text) return previous?.owner === owner && previous.text === text ? previous : { owner, text };
      return previous?.owner === owner ? null : previous;
    });
  }, []);

  const value = useMemo(() => ({ hint: current?.text ?? null, publish }), [current, publish]);
  return <HintContext.Provider value={value}>{children}</HintContext.Provider>;
}

/** Offers `text` as the current hint while it is not null, and withdraws it
 *  when it becomes null or the scene goes. */
export function usePublishHint(owner: string, text: string | null) {
  const { publish } = useContext(HintContext);
  useEffect(() => {
    publish(owner, text);
  }, [owner, text, publish]);
  useEffect(() => () => publish(owner, null), [owner, publish]);
}

export function useCurrentHint() {
  return useContext(HintContext).hint;
}
