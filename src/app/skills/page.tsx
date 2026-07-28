import type { Metadata } from "next";
import BackNavigationButton from "@/components/BackNavigationButton";
import SkillLink from "@/components/content/SkillLink";
import { getSkillsByCategory } from "@/lib/content/skills";

export const metadata: Metadata = {
  title: "Skills",
  description: "Explore the technologies, tools, and engineering skills I use across my projects.",
  alternates: { canonical: "/skills" },
  openGraph: {
    title: "Skills | Saikiran Kalluri",
    description: "How I learned and apply technologies across practical software projects.",
    url: "/skills",
  },
};

export default function SkillsPage() {
  const groups = getSkillsByCategory().filter((group) => group.skills.length > 0);

  return (
    <main className="relative z-10 min-h-[100svh] px-4 py-8 text-white sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <BackNavigationButton className="mb-14 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-sm text-gray-200 backdrop-blur-md transition-colors hover:border-blue-400/40 hover:text-white">
          <span aria-hidden="true">←</span> Back to portfolio
        </BackNavigationButton>

        <header className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-400">Technical experience</p>
          <h1 className="mt-4 text-4xl font-bold leading-none tracking-tight sm:text-6xl lg:text-7xl">
            Skills and technologies
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-300">
            Each skill includes a brief explanation of what it is, how I learned it,
            and the projects where I applied it.
          </p>
        </header>

        <div className="space-y-8 py-14 sm:py-20">
          {groups.map((group) => (
            <section
              key={group.category.slug}
              className="rounded-3xl border border-white/10 bg-black/60 p-6 backdrop-blur-md sm:p-8"
            >
              <h2 className="text-2xl font-bold">{group.category.label}</h2>
              <div className="mt-5 flex flex-wrap gap-3">
                {group.skills.map((skill) => <SkillLink key={skill.slug} skill={skill} />)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
