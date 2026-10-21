"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Loads the project pages ahead of a click on a drawn card.
 *
 * The carousel, the grid and the list draw their cards on the GPU, so a card
 * is not a <Link> and nothing prefetches its page: a tap waited for the page
 * to come from the server before anything happened, about 0.4s on a 4G-like
 * connection. These are a handful of small static pages, so all of them are
 * asked for once the cards are on screen, when the browser is idle.
 */
export function usePrefetchProjects(slugs: string[], extra: string[] = []) {
  const router = useRouter();
  const key = [...slugs, ...extra].join(",");
  useEffect(() => {
    const prefetch = () => {
      for (const slug of slugs) router.prefetch(`/projects/${slug}`);
      for (const href of extra) router.prefetch(href);
    };
    if ("requestIdleCallback" in window) {
      const handle = window.requestIdleCallback(prefetch, { timeout: 2000 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = setTimeout(prefetch, 1);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, key]);
}
