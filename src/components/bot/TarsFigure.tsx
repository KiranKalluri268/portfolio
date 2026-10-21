import { useId } from "react";
import styles from "./tars.module.css";

/** How TARS is standing: closed, slabs apart while it says a tip, or swung
 *  wide open while its chat is out. */
export type TarsPose = "closed" | "speaking" | "open";

/**
 * TARS as it is in the film: four brushed-metal slabs side by side, hinged so
 * they can swing apart, with the small display on the second one.
 *
 * Each slab is its own group so the pose can move them separately; the
 * movement itself is CSS, keyed off `data-pose`, so it eases between poses
 * from wherever it is.
 */
export default function TarsFigure({ pose, className = "" }: { pose: TarsPose; className?: string }) {
  // Drawn twice at once (the button and the chat's header), so its gradient
  // and grain need ids of their own.
  const id = `tars${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const metal = `${id}-metal`;
  const grain = `${id}-grain`;
  return (
    <svg
      className={`${styles.figure} ${className}`}
      data-pose={pose}
      viewBox="0 0 32 40"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Brushed metal: light catching the middle of each slab, darker at
            its edges, and a faint grain down its length. */}
        <linearGradient id={metal} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#5c6168" />
          <stop offset="0.35" stopColor="#c9cdd2" />
          <stop offset="0.6" stopColor="#9aa0a7" />
          <stop offset="1" stopColor="#4b5056" />
        </linearGradient>
        <pattern id={grain} width="1.2" height="40" patternUnits="userSpaceOnUse">
          <rect width="0.4" height="40" fill="#000" opacity="0.12" />
        </pattern>
      </defs>
      {[0, 1, 2, 3].map((index) => (
        <g key={index} className={styles.slab} data-slab={index}>
          <rect x={1.5 + index * 7.4} y="1.5" width="6.6" height="37" rx="0.6" fill={`url(#${metal})`} />
          <rect x={1.5 + index * 7.4} y="1.5" width="6.6" height="37" rx="0.6" fill={`url(#${grain})`} />
          {/* The joints the slabs fold at. */}
          <rect x={1.5 + index * 7.4} y="19.6" width="6.6" height="0.5" fill="#2a2d31" />
          {index === 1 && (
            <g>
              <rect x="9.6" y="5" width="5" height="7.5" rx="0.4" fill="#0b0c0e" />
              <rect className={styles.display} x="10.3" y="6.6" width="3.2" height="0.7" fill="#ff7a18" />
              <rect className={styles.display} x="10.3" y="8.4" width="2.2" height="0.7" fill="#ffb27a" />
              <rect className={styles.display} x="10.3" y="10.2" width="2.8" height="0.7" fill="#ff7a18" />
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}
