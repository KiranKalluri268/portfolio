import type { Metadata } from "next";
import Link from "next/link";
import PageScrim from "@/components/PageScrim";

export const metadata: Metadata = {
  title: "Not found",
  description: "There is no page at this address.",
  robots: { index: false, follow: true },
};

/** Every address that is not a page. Next's own 404 is black text on white,
 *  which on a site this dark does not read as "wrong address" — it reads as
 *  "this is broken". It sits inside the root layout, so the starfield, the
 *  black hole and the header are all still here: the site did not go anywhere,
 *  only the page. */
export default function NotFound() {
  return (
    <main className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <PageScrim />

      <div className="relative flex flex-col items-center">
        <p className="text-sm font-semibold tracking-[0.32em] text-accent-soft uppercase">404</p>

        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
          There is nothing at this address
        </h1>

        <p className="mt-4 max-w-md text-sm leading-relaxed text-gray-400 sm:text-base">
          Either I moved this page, or the link that brought you here was wrong.
          Both are fixable — here is the way back.
        </p>

        <nav
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
          aria-label="Somewhere that exists"
        >
          <Link
            href="/"
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-accent-soft"
          >
            Home
          </Link>
          <Link
            href="/projects"
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-gray-200 transition-colors hover:border-accent-soft/50 hover:text-white"
          >
            Projects
          </Link>
          <Link
            href="/skills"
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-gray-200 transition-colors hover:border-accent-soft/50 hover:text-white"
          >
            Skills
          </Link>
        </nav>
      </div>
    </main>
  );
}
