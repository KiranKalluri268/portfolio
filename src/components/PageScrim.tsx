/**
 * A soft dark pool behind centred copy.
 *
 * The black hole in the layout follows the pointer, so on a page whose text
 * sits in the middle it will land on the words sooner or later — and white
 * type on the bright side of the accretion disc is not readable. This
 * guarantees the contrast wherever the disc happens to be, without dimming the
 * starfield at the edges of the screen. The generated social card solves the
 * same problem the same way, with a gradient over the disc.
 *
 * Purely decorative: it must sit behind its own siblings, so anything it
 * protects needs `relative` on it.
 */
export default function PageScrim() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse 62% 46% at 50% 50%, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.82) 45%, rgba(0,0,0,0) 72%)",
      }}
    />
  );
}
