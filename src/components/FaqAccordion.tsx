"use client";

import { useRef, useState } from "react";
import { useScrollActions } from "@/context/SmoothScrollContext";

interface FaqItem {
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

  const handleToggle = (index: number) => {
    const wasOpen = openIndex === index;
    setOpenIndex(wasOpen ? null : index);
    if (wasOpen) return;

    // Closing whichever answer was open can shrink the page above this
    // question and carry it out of view before its own answer has finished
    // opening. Wait for that reflow to settle, then bring the question back
    // to a fixed spot under the header instead of wherever it landed.
    window.setTimeout(() => {
      const button = buttonRefs.current[index];
      if (!button) return;
      if (lenis) lenis.scrollTo(button, { offset: -HEADER_CLEARANCE_PX, duration: 0.4 });
      else button.scrollIntoView({ behavior: "smooth", block: "start" });
    }, COLLAPSE_MS);
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
