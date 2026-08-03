import Image from "next/image";
import Link from "next/link";
import type { SkillContent } from "@/lib/content/types";

export default function SkillLink({
  skill,
  className = "",
}: {
  skill: SkillContent;
  className?: string;
}) {
  const candidate = skill.iconText ?? skill.name.slice(0, 2);
  const monogram =
    candidate.toLowerCase() === skill.name.toLowerCase() ? null : candidate;

  return (
    <Link
      href={`/skills/${skill.slug}`}
      className={`inline-flex items-center gap-2 rounded-full border border-accent-soft/25 bg-accent/10 px-3 py-1.5 text-sm text-accent-tint transition-colors hover:border-accent-soft/60 hover:bg-accent-soft/15 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-soft ${className}`}
    >
      {skill.icon ? (
        <Image src={skill.icon} alt="" width={20} height={20} className="h-5 w-5 object-contain" />
      ) : (
        // The monogram stands in for a missing icon, so it is dropped when it
        // would just repeat the name it sits next to ("AWS AWS", "Git Git").
        monogram !== null && (
          <span className="flex h-5 min-w-5 items-center justify-center text-[0.65rem] font-bold" aria-hidden="true">
            {monogram}
          </span>
        )
      )}
      <span>{skill.name}</span>
    </Link>
  );
}
