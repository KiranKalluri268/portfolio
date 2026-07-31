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
  return (
    <Link
      href={`/skills/${skill.slug}`}
      className={`inline-flex items-center gap-2 rounded-full border border-blue-400/25 bg-blue-500/10 px-3 py-1.5 text-sm text-blue-100 transition-colors hover:border-blue-300/60 hover:bg-blue-400/15 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400 ${className}`}
    >
      {skill.icon ? (
        <Image src={skill.icon} alt="" width={20} height={20} className="h-5 w-5 object-contain" />
      ) : (
        <span className="flex h-5 min-w-5 items-center justify-center text-[0.65rem] font-bold" aria-hidden="true">
          {skill.iconText ?? skill.name.slice(0, 2)}
        </span>
      )}
      <span>{skill.name}</span>
    </Link>
  );
}
