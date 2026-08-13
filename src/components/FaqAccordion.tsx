"use client";

import { useEffect, useRef, useState } from "react";
import { useScrollActions } from "@/context/SmoothScrollContext";
import { readParam, writeParam } from "@/lib/deep-link";

interface FaqItem {
  /** Stable across edits and reordering, which a position in the list is not:
   *  a shared link to an answer should survive another question being added
   *  above it, or this one being reworded. */
  id: string;
  question: string;
  answer: string;
}

// Matches the panel's own transition-duration below — the scroll correction
// waits for the collapse to finish so it isn't fighting the reflow.
const COLLAPSE_MS = 300;

// Mirrors the scroll-mt-24 clearance Contact's own scroll target uses, so a
// question that opens lands the same distance from the header as any other
// scroll-to-section jump on the site.
const HEADER_CLEARANCE_PX = 96;

export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { lenis } = useScrollActions();

  /** Brings a question to the same place under the header that opening one
   *  does, whether it was opened by hand or arrived at through a link. */
  const revealAt = (index: number, force: boolean) => {
    const button = buttonRefs.current[index];
    if (!button) return;
    const { top, bottom } = button.getBoundingClientRect();
    const isOutOfView = top < HEADER_CLEARANCE_PX || bottom > window.innerHeight;
    if (!force && !isOutOfView) return;
    if (lenis) lenis.scrollTo(button, { offset: -HEADER_CLEARANCE_PX, duration: 0.4 });
    else button.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /** A question a link asked for, waiting to be scrolled to. */
  const pending = useRef<number | null>(null);

  // A link to a single answer opens it and goes to it. Anything the link names
  // that no longer exists is ignored rather than leaving the page half-obeying
  // an instruction it cannot follow. Read once, on arrival: afterwards the
  // visitor is driving, not the URL.
  useEffect(() => {
    const asked = readParam("q");
    if (!asked) return;
    const index = items.findIndex((item) => item.id === asked);
    if (index === -1) return;
    pending.current = index;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenIndex(index);
  }, [items]);

  // Going to it waits for Lenis, which the layout publishes a render after it
  // is built. Scrolling before then falls back to scrollIntoView, which knows
  // nothing about the fixed header and leaves the question underneath it.
  useEffect(() => {
    const index = pending.current;
    if (index === null || !lenis) return;
    pending.current = null;
    const timer = window.setTimeout(() => revealAt(index, true), COLLAPSE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lenis]);

  const handleToggle = (index: number) => {
    const wasOpen = openIndex === index;
    setOpenIndex(wasOpen ? null : index);
    // The open question names itself in the address bar, so the URL is already
    // the shareable one by the time anyone thinks to copy it. Closing clears
    // it — a page with nothing open should not claim otherwise.
    writeParam("q", wasOpen ? null : items[index].id);
    if (wasOpen) return;

    // Closing whichever answer was open can shrink the page above this
    // question and carry it out of view before its own answer has finished
    // opening. Wait for that reflow to settle, then check: if the question
    // is still on screen, leave it alone — only a question actually pushed
    // out from under the header or off the bottom gets scrolled back.
    window.setTimeout(() => revealAt(index, false), COLLAPSE_MS);
  };

  return (
    <section
      className="divide-y divide-white/10 border border-white/10 bg-black/60 backdrop-blur-md"
      aria-label="Frequently asked questions"
    >
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `faq-answer-${index}`;
        const buttonId = `faq-question-${index}`;

        return (
          <article key={item.question}>
            <h2 className="m-0">
              <button
                ref={(element) => {
                  buttonRefs.current[index] = element;
                }}
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => handleToggle(index)}
                className="flex w-full items-center justify-between gap-4 p-6 text-left text-lg font-bold leading-snug focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-soft sm:p-8 sm:text-xl"
              >
                <span>{item.question}</span>
                <span
                  aria-hidden="true"
                  className={`shrink-0 text-2xl text-accent-soft transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}
                >
                  +
                </span>
              </button>
            </h2>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className="grid transition-[grid-template-rows] duration-300 ease-out"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <p className="px-6 pb-6 leading-relaxed text-gray-300 sm:px-8 sm:pb-8 sm:text-base">
                  {item.answer}
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
