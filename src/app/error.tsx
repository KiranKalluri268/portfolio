"use client";

import Link from "next/link";
import { useEffect } from "react";
import PageScrim from "@/components/PageScrim";

/** Any route that throws while rendering. Without this, one bad render on any
 *  page replaces the whole site with Next's default error screen.
 *
 * `reset()` re-renders the segment that failed rather than reloading, so a
 * transient failure costs a click and nothing else. */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Until something is collecting these, the console is the only record there
    // is — and a digest with no message is all production hands you.
    console.error("Route error", error.digest ?? "", error);
  }, [error]);

  return (
    <main className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <PageScrim />

      <div className="relative flex flex-col items-center">
        <p className="text-sm font-semibold tracking-[0.32em] text-accent-soft uppercase">
          Something broke
        </p>

        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
          That went wrong on my side
        </h1>

        <p className="mt-4 max-w-md text-sm leading-relaxed text-gray-400 sm:text-base">
          Not something you did. Try it again — and if it keeps happening, the
          contact form on the home page reaches me.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="cursor-pointer rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-accent-soft"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-gray-200 transition-colors hover:border-accent-soft/50 hover:text-white"
          >
            Home
          </Link>
        </div>

        {/* Useless to a visitor, and the only thing that identifies the failure
            in a production log, so it is here but quiet. */}
        {error.digest && (
          <p className="mt-8 font-mono text-xs text-gray-600">Reference {error.digest}</p>
        )}
      </div>
    </main>
  );
}
