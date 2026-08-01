import Image from "next/image";
import Link from "next/link";
import BackNavigationButton from "@/components/BackNavigationButton";
import ProjectCard from "./ProjectCard";
import type { ProjectContent, SkillCategoryContent, SkillContent } from "@/lib/content/types";

function DetailSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="border-t border-white/10 py-9">
      <h2 className="text-2xl font-bold">{title}</h2>
      <div className="mt-5 space-y-4 leading-relaxed text-gray-300">
        {items.map((item) => <p key={item}>{item}</p>)}
      </div>
    </section>
  );
}

export default function SkillDetail({
  skill,
  category,
  projects,
}: {
  skill: SkillContent;
  category: SkillCategoryContent;
  projects: ProjectContent[];
}) {
  return (
    <main className="relative z-10 min-h-[100svh] px-4 py-8 text-white sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <BackNavigationButton className="mb-10 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-sm text-gray-200 backdrop-blur-md transition-colors hover:border-accent-soft/40 hover:text-white">
          <span aria-hidden="true">←</span> Back
        </BackNavigationButton>

        <header className="grid gap-8 rounded-3xl border border-white/10 bg-black/60 p-7 backdrop-blur-md sm:p-10 md:grid-cols-[auto_1fr] md:items-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-accent-soft/20 bg-accent/10 text-3xl font-bold text-accent-tint">
            {skill.icon ? (
              <Image src={skill.icon} alt={skill.iconAlt ?? ""} width={72} height={72} className="h-16 w-16 object-contain" />
            ) : (
              skill.iconText ?? skill.name.slice(0, 2)
            )}
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent-soft">
              {category.label}{skill.proficiency ? ` · ${skill.proficiency}` : ""}
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">{skill.name}</h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-gray-300">
              {skill.shortDescription}
            </p>
          </div>
        </header>

        <div className="mt-8 rounded-3xl border border-white/10 bg-black/60 px-7 backdrop-blur-md sm:px-10">
          <DetailSection title="What it is" items={skill.whatItIs} />
          <DetailSection title="How I learned it" items={skill.howILearned} />
          <DetailSection title="How I use it" items={skill.howIUseIt} />
          {skill.concepts.length > 0 && (
            <section className="border-t border-white/10 py-9">
              <h2 className="text-2xl font-bold">Concepts I work with</h2>
              <ul className="mt-5 flex flex-wrap gap-2">
                {skill.concepts.map((concept) => (
                  <li key={concept} className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-sm text-gray-300">
                    {concept}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <DetailSection title="What I learned" items={skill.lessonsLearned} />
        </div>

        <section className="py-12 sm:py-16">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent-soft">Applied experience</p>
          <h2 className="mt-3 text-3xl font-bold">Projects using {skill.name}</h2>
          {projects.length > 0 ? (
            <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => <ProjectCard key={project.slug} project={project} />)}
            </div>
          ) : (
            <p className="mt-5 text-gray-400">
              I haven&apos;t published a project using {skill.name} yet — it&apos;s something I
              use in work that isn&apos;t shareable, or that I&apos;m still building.
            </p>
          )}
        </section>

        <div className="pb-12 text-center">
          <Link href="/skills" className="text-sm font-semibold text-accent-tint underline underline-offset-8">
            Explore all skills
          </Link>
        </div>
      </div>
    </main>
  );
}
