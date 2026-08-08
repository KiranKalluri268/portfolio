"use client";

import { usePathname } from "next/navigation";
import { useAudio } from "@/context/AudioContextProvider";

/** A plain, server-rendered stand-in for the entry screen's black backdrop.
 *
 *  LoadingScreen portals itself to the body so it can sit above the site
 *  header, which needs a mounted DOM node and so cannot render until after
 *  hydration — meaning there is a real gap, not a token one, between the
 *  server-rendered HTML painting (the home page, uncovered) and that portal
 *  taking over. This renders in the same server pass as the header itself,
 *  so the curtain is already in the very first paint, no script required.
 *
 *  It only has to last until LoadingScreen is ready to take over, which is
 *  indistinguishable to a viewer since both are solid black. `hasEntered`
 *  flips the instant Enter is pressed, before the exit flight plays, so this
 *  clears itself while LoadingScreen's own overlay is still opaque on top of
 *  it - never exposing the page underneath early. */
export default function EntryCurtain() {
  const pathname = usePathname();
  const { hasEntered } = useAudio();

  if (pathname !== "/" || hasEntered) return null;

  return (
    <>
      <div id="entry-curtain" className="fixed inset-0 z-[9998] bg-black" aria-hidden="true" />
      {/* Without JS, LoadingScreen's portal never mounts and hasEntered can
          never flip, so the curtain above would otherwise block the page
          forever. Browsers only render <noscript> when scripting is off. */}
      <noscript>
        <style>{"#entry-curtain{display:none}"}</style>
      </noscript>
    </>
  );
}
