"use client";

import type { ReactNode } from "react";
import { useScrollSkew } from "@/hooks/useScrollSkew";

/** A plain wrapper that leans its contents with the scroll.
 *
 * A wrapper rather than the section itself, and always inside anything sticky
 * or pinned. A transform makes the element a containing block, so putting one
 * on an ancestor of `position: sticky` re-anchors the sticky to it, and an
 * ancestor of a ScrollTrigger pin breaks the pin outright — the pin works by
 * `position: fixed`. About is sticky and the projects carousel is pinned, so
 * both take this on their contents and never around them. */
export default function SkewOnScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useScrollSkew<HTMLDivElement>();
  return (
    <div ref={ref} className={className} style={{ willChange: "transform" }}>
      {children}
    </div>
  );
}
