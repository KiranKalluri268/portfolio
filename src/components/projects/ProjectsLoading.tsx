"use client";

import { useEffect, useState } from "react";
import { Bone, TextBones } from "@/components/skeleton/Skeleton";

/**
 * What /projects shows while its cards are being drawn: they are textures
 * built from each project's image, and on a slow connection the page sat empty
 * for seconds before the first one appeared. Card-shaped placeholders, in the
 * same place and size as the cards they stand for, fade out as soon as the
 * first real frame is on screen.
 *
 * The list view's card: as wide as the screen allows, up to 820px, never
 * taller than 78% of it — the same fit ProjectsStack uses. The grid's tiles:
 * a field of square cells around the middle.
 */

const FADE_MS = 400;

export default function ProjectsLoading({ view, drawn }: { view: "list" | "grid"; drawn: boolean }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!drawn) return;
    const timer = window.setTimeout(() => setGone(true), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [drawn]);
  if (gone) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden transition-opacity"
      style={{ opacity: drawn ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
      aria-busy={!drawn}
    >
      <p className="sr-only" role="status">{drawn ? "" : "Loading the projects"}</p>
      {view === "list" ? <ListCards /> : <GridTiles />}
    </div>
  );
}

function CardBones() {
  return (
    <>
      <Bone className="h-[8%] w-1/2" />
      <Bone className="mt-[4%] flex-1 rounded-2xl" />
      <div className="mt-[4%] flex gap-3">
        {[0, 1, 2, 3].map((i) => <Bone key={i} className="h-7 w-7 rounded-full" />)}
      </div>
    </>
  );
}

function ListCards() {
  // wide: 1200x690; on a phone the portrait card, 900x768. The first card is
  // centred, as the stack starts, with the next one peeking in below it.
  const card = "w-[min(88vw,820px,calc(78svh/0.575))] aspect-[1200/690] max-sm:w-[min(88vw,calc(78svh/0.853))] max-sm:aspect-[900/768]";
  const face = `${card} flex flex-col rounded-3xl border border-white/10 bg-black/60 p-[4%]`;
  return (
    <div aria-hidden="true" className="relative">
      <div className={face}>
        <CardBones />
      </div>
      <div className={`${face} absolute left-0 top-full mt-[max(28px,5svh)] opacity-50`}>
        <CardBones />
      </div>
    </div>
  );
}

function GridTiles() {
  return (
    <div aria-hidden="true" className="grid shrink-0 grid-cols-5 gap-6 max-sm:grid-cols-3">
      {Array.from({ length: 15 }, (_, i) => (
        <div key={i} className="flex aspect-square w-[min(22vw,240px)] flex-col rounded-3xl border border-white/10 bg-black/60 p-[6%] max-sm:w-[42vw]">
          <CardBones />
          <TextBones lines={1} className="mt-3" />
        </div>
      ))}
    </div>
  );
}
