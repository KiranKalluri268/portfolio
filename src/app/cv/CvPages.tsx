"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CV_PAGE_GAP_MS, CV_STEP_MS, REVEAL_LEAD_IN_MS, revealProps } from "@/components/paper-reveal";
import styles from "./cv.module.css";

/** A4 height and the CV's own vertical padding, in millimetres. */
const PAGE_MM = 297;
const PADDING_MM = 12;
/** Room kept at the foot of every sheet for the page number. */
const FOOTER_MM = 10;

export interface CvBlock {
  id: string;
  node: ReactNode;
  /** A heading must not be left stranded at the foot of a page with its
   *  content overleaf, so it moves down with whatever follows it. */
  keepWithNext?: boolean;
}

function mmToPx(mm: number) {
  // Measured rather than assumed at 96dpi, since browsers round it differently.
  const probe = document.createElement("div");
  probe.style.cssText = `position:absolute;visibility:hidden;height:${mm}mm`;
  document.body.appendChild(probe);
  const px = probe.getBoundingClientRect().height;
  probe.remove();
  return px;
}

/** Splits the CV across A4 sheets the way the download does.
 *
 * The CV is a document, so one endless sheet misrepresents it — the file a
 * recruiter opens is several numbered pages. Breaks are placed between blocks
 * and never through one, so nothing is ever cut mid-sentence. Exact parity with
 * the PDF is not on offer: react-pdf and the browser lay text out differently,
 * so the page count can differ by one.
 *
 * The first render puts every block on a single sheet. That is what the server
 * sends, so the whole CV is present for search engines and for anyone without
 * JavaScript; the split is measured and applied before the first paint.
 */
export default function CvPages({ blocks, label }: { blocks: CvBlock[]; label: string }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<number[][] | null>(null);

  // Measuring only means anything on the unsplit sheet: once split, each
  // block's position also carries the footers and gaps of the sheets above it.
  useLayoutEffect(() => {
    if (pages !== null) return;
    const sheet = sheetRef.current;
    if (!sheet) return;

    const children = Array.from(sheet.querySelectorAll<HTMLElement>("[data-cv-block]"));
    if (children.length === 0) return;
    const usable = mmToPx(PAGE_MM) - mmToPx(PADDING_MM) * 2 - mmToPx(FOOTER_MM);

    const next: number[][] = [];
    let current: number[] = [];
    let pageTop = children[0].offsetTop;

    children.forEach((child, index) => {
      const bottom = child.offsetTop + child.offsetHeight;
      if (current.length > 0 && bottom - pageTop > usable) {
        // Carry a trailing heading down with the block it introduces.
        const held: number[] = [];
        while (current.length > 0 && blocks[current[current.length - 1]]?.keepWithNext) {
          held.unshift(current.pop() as number);
        }
        // A heading held down on its own leaves nothing to finish this page
        // with — pushing it anyway would render as a blank sheet.
        if (current.length > 0) next.push(current);
        current = held;
        pageTop = children[held[0] ?? index].offsetTop;
      }
      current.push(index);
    });
    if (current.length > 0) next.push(current);
    setPages(next);
  }, [blocks, pages]);

  // Web fonts change how tall everything is, so if they were still loading
  // when the split was made, go back to the single sheet and split it again.
  // That happens inside one layout pass, so the single sheet is never painted.
  useLayoutEffect(() => {
    const fonts = document.fonts;
    if (!fonts || fonts.status === "loaded") return;
    let cancelled = false;
    fonts.ready.then(() => !cancelled && setPages(null)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [blocks]);

  // Before measuring: one sheet holding everything, which is also what the
  // server renders and what a reader without JavaScript keeps.
  if (pages === null) {
    return (
      <article className={styles.paper} aria-label={label}>
        {/* The same wrapper the split sheets use. Directly inside .paper the
            blocks would be flex items, whose margins never collapse, so every
            gap measured here would be taller than it renders once split and
            each sheet would break early. */}
        <div ref={sheetRef} className={styles.pageBody}>
          {blocks.map((block, index) => (
            <div
              data-cv-block
              key={block.id}
              {...revealProps(REVEAL_LEAD_IN_MS + index * CV_STEP_MS)}
            >
              {block.node}
            </div>
          ))}
        </div>
      </article>
    );
  }

  return (
    <article className={styles.pages} aria-label={label}>
      {pages.map((indices, pageIndex) => (
        <div className={styles.paper} key={blocks[indices[0]]?.id ?? pageIndex}>
          <div className={styles.pageBody}>
            {/* A page holds its blocks' indices into the flat list, in order, so
                `index` is already the position in the whole document — the
                writing carries on across a break rather than restarting at the
                top of each sheet. The extra beat per page is what makes the
                breaks legible as pages. */}
            {indices.map((index) => (
              <div
                data-cv-block
                key={blocks[index].id}
                {...revealProps(REVEAL_LEAD_IN_MS + index * CV_STEP_MS + pageIndex * CV_PAGE_GAP_MS)}
              >
                {blocks[index].node}
              </div>
            ))}
          </div>
          {/* Matches the footer the downloaded PDF prints. */}
          <p className={styles.pageNumber} aria-hidden="true">
            {pageIndex + 1} of {pages.length}
          </p>
        </div>
      ))}
    </article>
  );
}
