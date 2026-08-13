"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useScrollActions } from "@/context/SmoothScrollContext";
import { useReducedMotion } from "@/hooks/useMediaQuery";
import { lockPageScroll } from "../page-scroll-lock";
import { dropCoverIn, raiseCover } from "./navigation-cover";
import styles from "./site-menu.module.css";

/** Everywhere the menu can take you. Only pages that exist: an entry that goes
 *  nowhere is worse than a short list. */
const DESTINATIONS = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/skills", label: "Skills" },
  { href: "/faq", label: "FAQ" },
  { href: "/resume", label: "Résumé" },
  { href: "/cv", label: "CV" },
];

/** How long the circle takes to cover the screen, and to uncover it again. */
const REVEAL_MS = 520;

/** The cover is held until the new page is ready. If a route never arrives —
 *  offline, a redirect, a page that fails — this lifts it anyway rather than
 *  leaving the visitor looking at a blank screen. */
const NAVIGATION_TIMEOUT_MS = 2500;

/** A beat after the new route lands before the cover lifts, so the page behind
 *  it has painted. Lifting the moment the URL changes shows the new page
 *  assembling, which is the thing holding the cover was meant to avoid. */
const SETTLE_MS = 140;

/** Radius that reaches the furthest corner from a point. The circle grows from
 *  the button, so the corner diagonally opposite is the last thing covered. */
function radiusToCover(x: number, y: number) {
  return Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
}

export default function SiteMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { lenis } = useScrollActions();
  const reduceMotion = useReducedMotion();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  /** Where the circle grows from, and how far it has to go. */
  const [circle, setCircle] = useState({ x: 0, y: 0, radius: 0 });
  /** Drives the transition: mounted at radius 0, then grown on the next frame. */
  const [covered, setCovered] = useState(false);
  /** A destination whose page has been asked for but has not arrived yet. The
   *  cover stays up until it does, so the old page is never seen leaving. */
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    // Portalled to the body, so it has to wait for hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const close = useCallback(() => {
    // Anything on the page that animates as it arrives has been waiting behind
    // this; it starts when the screen is actually visible again.
    dropCoverIn(reduceMotion ? 0 : REVEAL_MS);
    setCovered(false);
    setPending(null);
    window.setTimeout(() => {
      setOpen(false);
      triggerRef.current?.focus();
    }, reduceMotion ? 0 : REVEAL_MS);
  }, [reduceMotion]);

  const openMenu = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    setCircle({ x, y, radius: radiusToCover(x, y) });
    setOpen(true);
  };

  // Grown on the frame after mounting, so the browser has a radius of 0 to
  // transition from. Setting both in one go is not an animation, it is a jump.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => setCovered(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // The page underneath must not scroll while the cover is over it. Lenis owns
  // scrolling on every route, so asking the window not to scroll is not enough.
  useEffect(() => {
    if (!open) return;
    // Counted, because the entry screen holds the page still too and both are
    // holding it at once while a route change to `/` is in flight.
    return lockPageScroll(lenis);
  }, [open, lenis]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab") return;
      // Nothing behind the cover is reachable, so tabbing cycles within it.
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>("a[href], button");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // The cover is held until the route it was asked for is the route we are on.
  useEffect(() => {
    if (pending === null) return;
    const arrived = pathname === pending;
    const timer = window.setTimeout(close, arrived ? SETTLE_MS : NAVIGATION_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [pending, pathname, close]);

  const go = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // Anything but a plain left click is the visitor asking the browser for it —
    // a new tab, a saved link — and none of that wants an animation.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    if (href === pathname) {
      close();
      return;
    }
    setPending(href);
    raiseCover();
    router.push(href);
  };

  const clip = covered
    ? `circle(${circle.radius}px at ${circle.x}px ${circle.y}px)`
    : `circle(0px at ${circle.x}px ${circle.y}px)`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={openMenu}
        aria-expanded={open}
        aria-controls="site-menu-panel"
        aria-label="Open menu"
      >
        <span className={styles.bars} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      {mounted && open && createPortal(
        <div
          ref={panelRef}
          id="site-menu-panel"
          className={styles.panel}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          data-covered={covered}
          style={{
            clipPath: reduceMotion ? undefined : clip,
            WebkitClipPath: reduceMotion ? undefined : clip,
            transitionDuration: reduceMotion ? "0ms" : `${REVEAL_MS}ms`,
          }}
        >
          {/* Sits exactly where the button that opened it is, so it reads as
              that button turning into a cross rather than a second control. */}
          <button
            ref={closeRef}
            type="button"
            className={styles.close}
            style={{ left: circle.x, top: circle.y }}
            onClick={close}
            aria-label="Close menu"
          >
            <span className={styles.bars} data-open="true" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>

          <nav className={styles.list} aria-label="Pages">
            {DESTINATIONS.map((destination, index) => {
              const isCurrent = pathname === destination.href;
              return (
                <Link
                  key={destination.href}
                  href={destination.href}
                  className={styles.link}
                  aria-current={isCurrent ? "page" : undefined}
                  data-current={isCurrent}
                  // Held back a beat each, so the list arrives after the cover
                  // rather than riding in with it.
                  style={{ transitionDelay: reduceMotion ? "0ms" : `${160 + index * 70}ms` }}
                  onClick={(event) => go(event, destination.href)}
                >
                  <span className={styles.index} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {destination.label}
                </Link>
              );
            })}
          </nav>
        </div>,
        document.body,
      )}
    </>
  );
}
