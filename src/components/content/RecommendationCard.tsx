import Link from "next/link";
import type { RecommendationEntry } from "@/lib/content/experience";

/** A quote from someone who managed one of the roles. Used on the homepage
 *  contact section; the experience detail pages render their own fuller
 *  version with the source link. */
export default function RecommendationCard({
  recommendation,
}: {
  recommendation: RecommendationEntry;
}) {
  const roleHref = `/experience/${recommendation.experienceSlug}`;
  // Either there are paragraphs the card is not showing, or the one it does
  // show is long enough that line-clamp-6 will cut it.
  const hasMore = recommendation.quote.length > 1 || recommendation.quote[0].length > 320;

  return (
    <figure className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/55 p-6 text-left shadow-xl backdrop-blur-sm transition-[background-color,border-color] duration-300 hover:border-accent-soft/25 hover:bg-white/5 sm:p-7">
      <span
        className="pointer-events-none absolute -top-5 left-3 select-none font-serif text-7xl leading-none text-accent/15"
        aria-hidden="true"
      >
        &ldquo;
      </span>

      {/* Full recommendations run long enough to bury the contact form beneath
          them, so the card shows an excerpt and sends readers to the role page
          for the rest. */}
      <blockquote className="relative mb-6 text-sm leading-relaxed text-gray-300">
        <p className="line-clamp-6">{recommendation.quote[0]}</p>
        {hasMore && (
          <Link
            href={roleHref}
            className="mt-3 inline-flex items-center gap-1 rounded text-xs font-semibold text-accent-soft transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-soft"
          >
            View more
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </blockquote>

      {/* mt-auto so attributions line up along the bottom of the row even when
          one quote is much shorter than the other. */}
      <figcaption className="mt-auto border-t border-white/10 pt-4">
        <span className="block text-sm font-semibold text-white">{recommendation.author}</span>
        <span className="mt-0.5 block text-xs text-accent-soft">
          {recommendation.authorTitle}
        </span>
        <span className="mt-1.5 block text-[0.7rem] uppercase tracking-wider text-gray-500">
          {recommendation.relationship ?? recommendation.company}
          {recommendation.dateLabel && (
            <>
              <span aria-hidden="true"> · </span>
              {recommendation.date ? (
                <time dateTime={recommendation.date}>{recommendation.dateLabel}</time>
              ) : (
                recommendation.dateLabel
              )}
            </>
          )}
        </span>
        <Link
          href={roleHref}
          className="mt-3 inline-flex items-center gap-1 rounded text-xs font-semibold text-blue-300 transition-colors hover:text-blue-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400"
        >
          {recommendation.roleTitle} at {recommendation.company}
          <span aria-hidden="true">→</span>
        </Link>
      </figcaption>
    </figure>
  );
}
