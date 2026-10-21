import { useId, type CSSProperties } from "react";
import styles from "./tars.module.css";

/** What TARS is doing: standing closed; walking a couple of steps in place
 *  before it speaks; one arm raised to present a tip; or both arms swung
 *  open while its chat is out. */
export type TarsPose = "closed" | "walking" | "speaking" | "open";

/** How long the walk takes before the arm comes up: two steps. Matches
 *  tars.module.css. */
export const TARS_WALK_MS = 900;

const SLAB_WIDTH = 6.6;
const SLAB_GAP = 0.8;
const TOP = 1.5;
/** Where each slab folds: TARS's slabs are two segments, hinged here. */
const JOINT = 19.6;
const BOTTOM = 38.5;

/**
 * TARS as it is in the film: four brushed-metal slabs side by side, with the
 * small display on the second one. Each slab is drawn as two segments joined
 * at its fold, so a limb can bend there.
 *
 * Every slab is three nested groups, because each motion turns about its own
 * point and an element has only one transform-origin:
 *   leg      — the walk, about the top of the slab, foreshortening as it swings
 *              towards the viewer the way TARS's slabs do when it steps;
 *   arm      — swinging out, about the shoulder where it meets the next slab;
 *   forearm  — the lower segment bending at the fold.
 * The movement is CSS, keyed off `data-pose`.
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
      {[0, 1, 2, 3].map((index) => {
        const x = 1 + index * (SLAB_WIDTH + SLAB_GAP);
        // The outer slabs are the arms, hinged where they meet the body.
        const shoulderX = index === 0 ? x + SLAB_WIDTH : index === 3 ? x : x + SLAB_WIDTH / 2;
        const pivots = {
          "--leg-origin": `${x + SLAB_WIDTH / 2}px ${TOP}px`,
          "--arm-origin": `${shoulderX}px ${TOP}px`,
          "--elbow-origin": `${shoulderX}px ${JOINT}px`,
        } as CSSProperties;
        const segment = (y: number, height: number) => (
          <>
            <rect x={x} y={y} width={SLAB_WIDTH} height={height} rx="0.6" fill={`url(#${metal})`} />
            <rect x={x} y={y} width={SLAB_WIDTH} height={height} rx="0.6" fill={`url(#${grain})`} />
          </>
        );
        return (
          <g key={index} className={styles.leg} data-slab={index} style={pivots}>
            <g className={styles.arm}>
              {segment(TOP, JOINT - TOP - 0.25)}
              {index === 1 && (
                <g>
                  <rect x={x + 0.8} y="5" width="5" height="7.5" rx="0.4" fill="#0b0c0e" />
                  <rect className={styles.display} x={x + 1.5} y="6.6" width="3.2" height="0.7" fill="#ff7a18" />
                  <rect className={styles.display} x={x + 1.5} y="8.4" width="2.2" height="0.7" fill="#ffb27a" />
                  <rect className={styles.display} x={x + 1.5} y="10.2" width="2.8" height="0.7" fill="#ff7a18" />
                </g>
              )}
              <g className={styles.forearm}>{segment(JOINT + 0.25, BOTTOM - JOINT - 0.25)}</g>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
