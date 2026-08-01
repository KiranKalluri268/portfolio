"use client";

import {
  SECTION_IDS,
  useScrollActions,
  type SectionId,
} from "@/context/SmoothScrollContext";

interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
}

const SECTION_ID_SET = new Set<string>(SECTION_IDS);

export default function SkipLink({ href, children }: SkipLinkProps) {
  const { scrollToSection } = useScrollActions();

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const id = href.slice(1);
    const target = document.getElementById(id);
    if (!target) return;

    event.preventDefault();
    if (SECTION_ID_SET.has(id)) {
      scrollToSection(id as SectionId);
    } else {
      target.scrollIntoView({ block: "start" });
    }

    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-accent-soft focus:text-black focus:rounded"
    >
      {children}
    </a>
  );
}
