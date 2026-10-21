import type { CSSProperties, ReactNode } from "react";

/**
 * Placeholders shown the moment a page is asked for, shaped like what is
 * coming: the page changes on the click, and fills in as it arrives.
 *
 * Plain server components with no state, so a route's loading.tsx can be sent
 * ahead with the prefetch and shown with no JavaScript of its own. The shimmer
 * is CSS (`.skeleton` in globals.css) and stands still under reduced motion.
 * Every placeholder is aria-hidden; the wrapper says, once, that the page is
 * loading.
 */

export function Bone({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden="true" className={`skeleton rounded-lg ${className}`} style={style} />;
}

/** Lines of text, the last one shorter, as a paragraph's last line is. */
export function TextBones({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Bone key={i} className="h-4" style={{ width: i === lines - 1 ? "62%" : "100%" }} />
      ))}
    </div>
  );
}

/** The page's own frame, the same as the content pages', saying it is loading. */
export function SkeletonPage({ children, label, width = "max-w-6xl" }: { children: ReactNode; label: string; width?: string }) {
  return (
    <main
      className="body-text relative z-10 min-h-[100svh] px-4 pt-24 pb-8 text-white sm:px-6 sm:pt-28 sm:pb-12"
      aria-busy="true"
    >
      <p className="sr-only" role="status">{label}</p>
      <div className={`mx-auto ${width}`}>{children}</div>
    </main>
  );
}

/** A detail page: back link, eyebrow, title, summary, buttons, a hero panel
 *  and the first section. Project, experience and skill pages share it. */
export function DetailSkeleton({ label, hero = true, width }: { label: string; hero?: boolean; width?: string }) {
  return (
    <SkeletonPage label={label} width={width}>
      <Bone className="mb-10 h-9 w-24 rounded-full" />
      <div className="mb-10 max-w-4xl sm:mb-14">
        <Bone className="h-4 w-56" />
        <Bone className="mt-5 h-10 w-4/5 sm:h-14" />
        <TextBones lines={2} className="mt-7" />
        <div className="mt-7 flex gap-3">
          <Bone className="h-10 w-32 rounded-full" />
          <Bone className="h-10 w-32 rounded-full" />
        </div>
      </div>
      {hero && <Bone className="aspect-[16/9] w-full rounded-3xl" />}
      <div className="mt-10 rounded-3xl border border-white/10 bg-black/60 p-6 sm:p-10">
        <Bone className="h-6 w-40" />
        <TextBones lines={4} className="mt-6" />
      </div>
    </SkeletonPage>
  );
}
