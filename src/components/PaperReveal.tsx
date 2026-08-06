"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { whenUncovered } from "./nav/navigation-cover";
import { REVEAL_MS } from "./paper-reveal";

/**
 * Brings a document onto its sheet a piece at a time.
 *
 * The paper is there from the first frame — it is the page, not an effect — and
 * what arrives is the writing on it: the header, then each section, in reading
 * order, page by page. A document that assembles itself in the order you would
 * read it is doing the same thing as a document that is simply there, only it
 * shows you where to start.
 *
 * This owns *when*, not *what*. It renders no box of its own (`display:
 * contents`), so nothing about the résumé's or CV's layout depends on it — it
 * is only an ancestor for the class that drives the pieces, and every delay is
 * carried by the piece itself through `--reveal-delay`.
 */

export default function PaperReveal({ children }: { children: ReactNode }) {
  // Reduced motion is done before the first paint rather than switched to done
  // by an effect afterwards, which would be a flash of hidden text.
  const [state, setState] = useState<"waiting" | "writing" | "done">(() =>
    typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "done" : "waiting");

  useEffect(() => {
    if (state !== "waiting") return;
    let frame = 0;
    // Reached through the site menu, this page mounts behind its cover; without
    // waiting, the document would write itself on a hidden screen.
    const cancel = whenUncovered(() => {
      // Two waits, and both matter for a document. Web fonts change how tall
      // every block is, so starting before they land means fading text in and
      // then reflowing it — and on the CV it means the paginator re-measuring
      // mid-animation, which restarts every piece. The frame after is there so
      // this does not depend on CvPages' own fonts.ready callback having been
      // registered first, even though child effects guarantee that it was.
      const begin = () => {
        frame = requestAnimationFrame(() => setState("writing"));
      };
      if (document.fonts?.ready) document.fonts.ready.then(begin).catch(begin);
      else begin();
    });
    return () => {
      cancel();
      cancelAnimationFrame(frame);
    };
  }, [state]);

  // Someone who scrolls is reading, and the rest of the document is still
  // blank paper below them. Any move for the page finishes the writing at once.
  useEffect(() => {
    if (state !== "writing") return;
    const skip = () => setState("done");
    window.addEventListener("pointerdown", skip, { passive: true });
    window.addEventListener("wheel", skip, { passive: true });
    window.addEventListener("touchmove", skip, { passive: true });
    window.addEventListener("keydown", skip, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchmove", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [state]);

  return (
    <div
      // Custom properties inherit through a `display: contents` box, so the
      // duration reaches every piece without this being in the layout.
      style={{ display: "contents", "--paper-reveal-ms": `${REVEAL_MS}ms` } as CSSProperties}
      className={state === "waiting" ? "paper-blank" : state === "writing" ? "paper-writing" : undefined}
    >
      {/* The server renders the waiting state, and only script moves it on. A
          reader without JavaScript would otherwise be handed blank paper — the
          one failure mode a résumé cannot have. Written as raw HTML because
          React 19 hoists a real <style> element into <head>, where it would
          apply to everyone rather than to nobody. */}
      <noscript
        dangerouslySetInnerHTML={{
          __html: "<style>.paper-blank [data-reveal]{opacity:1}</style>",
        }}
      />
      {children}
    </div>
  );
}
