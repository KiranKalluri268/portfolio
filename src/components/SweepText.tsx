"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import gsap from "gsap";
import {
  GROUP_STAGGER_MS,
  LETTER_DURATION_MS,
  LETTER_STAGGER_MS,
  SWEEP_EASE,
} from "./hero-sweep-timing";

export type SweepDirection = "bottom" | "top";

export interface SweepTextHandle {
  /** Sweeps every letter in from `direction`, left letter first within each
   *  word. Resolves once the last letter has landed. */
  enter: (direction: SweepDirection) => Promise<void>;
  /** Sweeps every letter back out toward `direction` - the same order as
   *  enter, so a line that came in from the bottom leaves toward the bottom
   *  as one continuing motion rather than reversing itself. */
  exit: (direction: SweepDirection) => Promise<void>;
}

type Letter = { char: string; word: number };

/** Splits into letters while remembering which word each one belongs to -
 *  spaces get their own marker so they can be rendered as plain, unwrapped
 *  characters (that is what lets the browser break the line after one,
 *  rather than gluing every word into one unbreakable run) and excluded from
 *  the animation entirely. */
function splitIntoWords(text: string): Letter[] {
  const letters: Letter[] = [];
  let word = 0;
  for (const char of text) {
    if (char === " ") {
      letters.push({ char, word: -1 });
      word += 1;
    } else {
      letters.push({ char, word });
    }
  }
  return letters;
}

/** One line of text, split into per-letter spans an imperative handle can
 *  sweep in and out. The letters are the visual layer only - callers that
 *  need the text announced put it in an sr-only sibling, the same way the
 *  typewriter this replaces did.
 *
 *  Splitting happens on every render rather than being memoised on `text`:
 *  the caller swaps `text` and then immediately calls `enter`, and a stale
 *  set of letter refs from the previous word would animate spans that no
 *  longer exist.
 *
 *  Letters start invisible rather than waiting for the first `enter()` call
 *  to hide them - that call only lands a render or more after this mounts
 *  (an effect, not the render itself), and by then the greeting overlay that
 *  was covering this text is already gone. Without a hidden default, the
 *  settled line flashes on screen for that gap before its own entrance has
 *  played. */
const SweepText = forwardRef<
  SweepTextHandle,
  { text: string; className?: string; groupByWord?: boolean }
>(function SweepText({ text, className, groupByWord = false }, ref) {
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const letters = useMemo(() => splitIntoWords(text), [text]);
  // Consecutive same-word letter indices, grouped so each word can be
  // rendered inside its own wrapper - see the note on `wordSpans` below.
  const runs = useMemo(() => {
    const result: { word: number; indices: number[] }[] = [];
    letters.forEach((letter, index) => {
      const last = result[result.length - 1];
      if (letter.word !== -1 && last && last.word === letter.word) {
        last.indices.push(index);
      } else if (letter.word !== -1) {
        result.push({ word: letter.word, indices: [index] });
      } else {
        result.push({ word: -1, indices: [] });
      }
    });
    return result;
  }, [letters]);

  useImperativeHandle(ref, () => ({
    enter(direction) {
      return animate(letterRefs.current, letters, groupByWord, direction, "enter");
    },
    exit(direction) {
      return animate(letterRefs.current, letters, groupByWord, direction, "exit");
    },
  }));

  return (
    <span className={className} aria-hidden="true">
      {runs.map((run, runIndex) =>
        run.word === -1 ? (
          <span key={runIndex}> </span>
        ) : (
          // Each letter is `inline-block` so it can be translated - but a run
          // of adjacent inline-block boxes gets its own break opportunity
          // between every one of them, not just between words, which is what
          // was splitting a word like "ENGINEER" across two lines. Wrapping
          // the run in one more inline-block, sized to fit its own content,
          // makes the word itself the atomic unit the line wraps around.
          <span key={runIndex} className="inline-block whitespace-nowrap">
            {run.indices.map((index) => (
              <span
                key={index}
                ref={(el) => {
                  letterRefs.current[index] = el;
                }}
                className="inline-block opacity-0"
              >
                {letters[index].char}
              </span>
            ))}
          </span>
        ),
      )}
    </span>
  );
});

/** Runs one sweep. Within a word the letters lead left to right, same as
 *  ever. Across words, when `groupByWord` is on, the word nearer the edge
 *  the motion is headed toward goes first - moving toward the bottom, the
 *  lower word leads; toward the top, the upper word leads - so the whole
 *  line reads as leaning into its own direction rather than every word
 *  arriving in step. */
function animate(
  refs: (HTMLSpanElement | null)[],
  letters: Letter[],
  groupByWord: boolean,
  direction: SweepDirection,
  phase: "enter" | "exit",
): Promise<void> {
  const entries = refs
    .map((el, index) => (el ? { el, word: letters[index].word } : null))
    .filter((entry): entry is { el: HTMLSpanElement; word: number } => entry !== null);
  if (entries.length === 0) return Promise.resolve();

  const wordIds = Array.from(new Set(entries.map((entry) => entry.word)));
  // With one word, or when word order shouldn't matter, everything leads
  // together - the per-word offset below is simply zero for all of them.
  const leadOrder =
    groupByWord && wordIds.length > 1
      ? direction === "bottom"
        ? [...wordIds].reverse()
        : wordIds
      : wordIds;

  const seenInWord = new Map<number, number>();
  const delayFor = new Map<HTMLSpanElement, number>();
  for (const { el, word } of entries) {
    const withinWord = seenInWord.get(word) ?? 0;
    seenInWord.set(word, withinWord + 1);
    const wordDelay = leadOrder.indexOf(word) * GROUP_STAGGER_MS;
    delayFor.set(el, (wordDelay + withinWord * LETTER_STAGGER_MS) / 1000);
  }

  const els = entries.map((entry) => entry.el);
  const offscreen = direction === "bottom" ? 120 : -120;

  return new Promise((resolve) => {
    gsap.killTweensOf(els);
    const vars = {
      yPercent: phase === "enter" ? 0 : offscreen,
      opacity: phase === "enter" ? 1 : 0,
      duration: LETTER_DURATION_MS / 1000,
      ease: SWEEP_EASE,
      delay: (i: number, target: Element) => delayFor.get(target as HTMLSpanElement) ?? 0,
      onComplete: resolve,
    };
    if (phase === "enter") {
      gsap.fromTo(els, { yPercent: offscreen, opacity: 0 }, vars);
    } else {
      gsap.to(els, vars);
    }
  });
}

export default SweepText;
