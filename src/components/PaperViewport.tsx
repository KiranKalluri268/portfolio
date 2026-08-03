"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Shows a fixed-width page at whatever size the screen allows.
 *
 * The résumé and CV are documents, not articles: their value is that they look
 * like the PDF a recruiter downloads. Reflowing them for a phone — bigger type,
 * more lines, a page that scrolls forever — makes them read as a web page
 * instead, and loses the one-glance shape of an A4 sheet. So the page keeps its
 * exact A4 geometry at every width and is scaled down to fit instead. Text
 * becomes small on a phone, which is fine: pinch-zoom is left enabled, and the
 * layout under the zoom is the real one.
 *
 * Desktop is untouched. Scaling only engages when the viewport is narrower than
 * the sheet, so anything with room for a full 210mm renders at 1:1 as before.
 */
export default function PaperViewport({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const paper = paperRef.current;
    if (!frame || !paper) return;

    let lastAvailable = -1;
    let lastNaturalHeight = -1;

    const fit = () => {
      // offsetWidth/offsetHeight report the untransformed layout box;
      // getBoundingClientRect would report the scale already applied and the
      // measurement would creep on every pass.
      const naturalWidth = paper.offsetWidth;
      const naturalHeight = paper.offsetHeight;
      const available = frame.clientWidth;
      if (!naturalWidth || !available) return;
      // Setting the frame's height below re-triggers the observer watching it,
      // so ignore anything that is not a real change.
      if (available === lastAvailable && naturalHeight === lastNaturalHeight) return;
      lastAvailable = available;
      lastNaturalHeight = naturalHeight;

      const scale = Math.min(1, available / naturalWidth);
      paper.style.transform = scale < 1 ? `scale(${scale})` : "";
      // A transform does not affect layout, so without this the page keeps the
      // full-size sheet's height and leaves a long empty gap beneath it.
      frame.style.height = scale < 1 ? `${naturalHeight * scale}px` : "";
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    observer.observe(paper);
    // Web fonts land after first paint and change how tall the sheet is.
    document.fonts?.ready.then(fit).catch(() => {});

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className={className}>
      {/* fit-content so this hugs the fixed-width sheet rather than the frame,
          which is what makes the natural width measurable. */}
      <div ref={paperRef} style={{ width: "fit-content", transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}
