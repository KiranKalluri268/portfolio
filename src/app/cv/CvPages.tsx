"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
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

  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;

    const measure = () => {
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
          next.push(current);
          current = held;
          pageTop = children[held[0] ?? index].offsetTop;
        }
        current.push(index);
      });
      if (current.length > 0) next.push(current);
      setPages(next);
    };

    measure();
    // Web fonts change how tall everything is, so the split is re-measured once
    // they land rather than being left wrong.
    document.fonts?.ready.then(measure).catch(() => {});
  }, [blocks]);

  // Before measuring: one sheet holding everything, which is also what the
  // server renders and what a reader without JavaScript keeps.
  if (pages === null) {
    return (
      <article ref={sheetRef} className={styles.paper} aria-label={label}>
        {blocks.map((block) => (
          <div data-cv-block key={block.id}>
            {block.node}
          </div>
        ))}
      </article>
    );
  }

  return (
    <article className={styles.pages} aria-label={label}>
      {pages.map((indices, pageIndex) => (
        <div className={styles.paper} key={blocks[indices[0]]?.id ?? pageIndex}>
          <div className={styles.pageBody}>
            {indices.map((index) => (
              <div data-cv-block key={blocks[index].id}>
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
