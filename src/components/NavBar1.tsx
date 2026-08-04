'use client';

import { useHoverLabel } from "@/hooks/useHoverLabel";
import Link from 'next/link';
import AudioToggle from './AudioToggle';
import SiteMenu from './nav/SiteMenu';
import Tooltip from './Tooltip';

export default function NavBar() {
  const [hoveredItem, setHoveredItem] = useHoverLabel<string>();

  return (
    <header
      className="pointer-events-none fixed top-0 right-0 left-0 z-50 flex w-full items-center justify-between px-5 pt-6 pb-0 text-white sm:px-12 sm:pt-10 lg:px-20 lg:pt-15"
      role="banner"
    >
      <div className="pointer-events-auto text-2xl font-bold sm:text-3xl" id="site-title">
        <Link href="/" aria-label="Saikiran Kalluri Portfolio - Home">
          KS
        </Link>
      </div>
      <nav className="pointer-events-auto" aria-label="Main navigation" role="navigation">
        <ul className="flex space-x-6 text-lg items-center" role="list">


          <li role="listitem">
            <div
              onMouseEnter={() => setHoveredItem("Audio")}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <AudioToggle />
            </div>
          </li>

          {/* The way to every other page. The header is on every route now, so
              on the deep pages this is the only navigation there is. */}
          <li role="listitem">
            <SiteMenu />
          </li>
        </ul>
      </nav>
      <Tooltip text="Audio" isVisible={hoveredItem === "Audio"} />
    </header>
  );
}
