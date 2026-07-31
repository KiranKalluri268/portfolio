"use client";

import { useSyncExternalStore } from "react";

// One subscriber per query, cached so useSyncExternalStore does not resubscribe
// on every render.
const subscribers = new Map<string, (callback: () => void) => () => void>();

function getSubscriber(query: string) {
  let subscribe = subscribers.get(query);
  if (!subscribe) {
    subscribe = (callback: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", callback);
      return () => list.removeEventListener("change", callback);
    };
    subscribers.set(query, subscribe);
  }
  return subscribe;
}

/**
 * Reactive media query. Returns `false` during server render and the first
 * client paint, so callers should treat `false` as "not yet known".
 */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    getSubscriber(query),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

/** True on touch-first devices, where hover-driven affordances never fire. */
export const useCoarsePointer = () => useMediaQuery("(hover: none)");
