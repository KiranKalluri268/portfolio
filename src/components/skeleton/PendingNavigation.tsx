"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { skeletonFor } from "./RouteSkeleton";

/** Raised by code that navigates without a link — a drawn card's tap — just
 *  before it calls router.push, so the skeleton can go up on the same frame. */
export const NAVIGATE_EVENT = "portfolio:navigate";

export function announceNavigation(href: string) {
  window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: href }));
}

/** Give up on a navigation that never lands rather than cover the page. */
const GIVE_UP_MS = 15000;

/**
 * The page changes the moment a link is clicked.
 *
 * A route's loading.tsx only shows once the router has it, and for a page not
 * yet prefetched that is a round trip to the server: until then the old page
 * sat there and the click looked ignored. So any click on an internal link,
 * and any drawn card announcing a navigation, puts the destination's skeleton
 * up straight away, over the page being left. It comes down when the address
 * changes, by which time the page or its own loading.tsx is there to take
 * over.
 */
export default function PendingNavigation() {
  const pathname = usePathname();
  const [pending, setPending] = useState<{ to: string; from: string } | null>(null);

  useEffect(() => {
    const go = (href: string) => {
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      if (!skeletonFor(url.pathname)) return;
      setPending({ to: url.pathname, from: window.location.pathname });
    };

    const onClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;
      // The site menu covers the screen itself while it changes page.
      if (link.closest("#site-menu-panel")) return;
      go(link.href);
    };
    const onAnnounce = (event: Event) => go((event as CustomEvent<string>).detail);

    // Captured, before the link's own handler: Next's <Link> cancels the
    // click's default to navigate itself, so a listener after it cannot tell
    // a navigating link from a cancelled one.
    window.addEventListener("click", onClick, true);
    window.addEventListener(NAVIGATE_EVENT, onAnnounce);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener(NAVIGATE_EVENT, onAnnounce);
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setPending(null), GIVE_UP_MS);
    // The page being left is hidden rather than dimmed: seen through the
    // skeleton it read as the two pages laid over each other.
    document.documentElement.dataset.navigating = "true";
    return () => {
      window.clearTimeout(timer);
      delete document.documentElement.dataset.navigating;
    };
  }, [pending]);

  // Arrived (or went somewhere else): the new page is in charge now.
  if (pending && pathname !== pending.from) {
    setPending(null);
  }
  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-[40] overflow-y-auto">
      {skeletonFor(pending.to)}
    </div>
  );
}
