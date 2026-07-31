import Image from "next/image";
import type { ProjectContent } from "@/lib/content/types";

/** Derives a short monogram from the title, e.g. "HealthyMitra – Care …" → "HM". */
function monogram(title: string) {
  const words = title
    .replace(/[–—-].*$/, "")
    .split(/\s+/)
    .filter((word) => /[A-Za-z0-9]/.test(word));
  if (words.length === 0) return "··";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Project imagery, with a generated panel for work that has no shareable
 *  screenshot. Keeps the card grid visually even instead of leaving a hole. */
export default function ProjectThumbnail({
  project,
  sizes,
  priority = false,
  className = "object-cover",
}: {
  project: ProjectContent;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (project.image) {
    return (
      <Image
        src={project.image}
        alt={project.imageAlt ?? ""}
        fill
        priority={priority}
        quality={90}
        sizes={sizes}
        className={className}
      />
    );
  }

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_30%_25%,rgba(59,130,246,0.22),transparent_60%),radial-gradient(circle_at_75%_80%,rgba(139,92,246,0.18),transparent_55%)]"
      aria-hidden="true"
    >
      <span className="text-4xl font-bold tracking-[0.2em] text-white/85 sm:text-5xl">
        {monogram(project.title)}
      </span>
      <span className="max-w-[80%] text-center text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white/40">
        {project.role}
      </span>
    </div>
  );
}
