/** The hint itself: one pill, low in the viewport, that fades in and out.
 *
 * `aria-hidden` on purpose. Every line it shows is about a gesture — swipe,
 * scroll, click — which is noise to someone navigating by headings and skip
 * links, and it would be announced again on every scene. */
// The default sits clear of the other two fixed controls, which do not share
// a corner: the scene dots are bottom-centre on mobile and move to the top on
// desktop, where the arrow pad takes the bottom-right instead. Position and
// text size travel together so an override replaces both at once rather than
// fighting the default size with a same-specificity class.
const DEFAULT_CLASSNAME =
  "fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 text-xs sm:bottom-32";

export default function HintPill({
  text,
  visible,
  className = DEFAULT_CLASSNAME,
}: {
  text: string;
  visible: boolean;
  /** Position and text-size override, replacing DEFAULT_CLASSNAME entirely.
   *  The skill universe passes an absolute position so the pill sits inside
   *  its canvas; the hero passes a lower, larger variant of its own. */
  className?: string;
}) {
  return (
    <div
      className={`hint-pill pointer-events-none z-40 max-w-[min(90vw,34rem)] -translate-x-1/2 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-center text-gray-300 backdrop-blur-md transition-opacity duration-500 ${className} ${visible ? "opacity-100" : "opacity-0"}`}
      aria-hidden="true"
    >
      {text}
    </div>
  );
}
