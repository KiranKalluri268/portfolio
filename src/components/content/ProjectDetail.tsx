import Link from "next/link";
import BackNavigationButton from "@/components/BackNavigationButton";
import ProjectThumbnail from "./ProjectThumbnail";
import SkillLink from "./SkillLink";
import type { ProjectContent, SkillContent } from "@/lib/content/types";

function TextList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-3 text-gray-300">
      {items.map((item) => (
        <li key={item} className="flex gap-3 leading-relaxed">
          <span className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-soft" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-white/10 py-10 sm:py-14">
      <h2 className="mb-6 text-2xl font-bold sm:text-3xl">{title}</h2>
      {children}
    </section>
  );
}

export default function ProjectDetail({
  project,
  skills,
}: {
  project: ProjectContent;
  skills: SkillContent[];
}) {
  return (
    <main className="relative z-10 min-h-[100svh] px-4 py-8 text-white sm:px-6 sm:py-12">
      <article className="mx-auto max-w-6xl">
        <BackNavigationButton className="mb-10 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-sm text-gray-200 backdrop-blur-md transition-colors hover:border-accent-soft/40 hover:text-white">
          <span aria-hidden="true">←</span> Back
        </BackNavigationButton>

        <header className="mb-10 max-w-4xl sm:mb-14">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent-soft">
            Project case study · {project.role}
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            {project.title}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-300 sm:text-xl">
            {project.summary}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-accent-tint"
              >
                Open live project <span aria-hidden="true">↗</span>
              </a>
            )}
            {project.repositoryUrl && (
              <a
                href={project.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/20 bg-black/45 px-5 py-2.5 text-sm font-semibold hover:border-accent-soft/60 hover:text-accent-tint"
              >
                View source <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
        </header>

        <div className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-white/10 bg-black/60 shadow-2xl">
          <ProjectThumbnail
            project={project}
            priority
            sizes="(max-width: 1200px) calc(100vw - 2rem), 1152px"
          />
        </div>

        <div className="mt-10 rounded-3xl border border-white/10 bg-black/60 px-6 backdrop-blur-md sm:px-10">
          <Section title="What it is">
            <div className="max-w-4xl space-y-4 text-base leading-relaxed text-gray-300 sm:text-lg">
              {project.overview.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </Section>

          {(project.problem || project.solution) && (
            <Section title="Problem and approach">
              <div className="grid gap-6 md:grid-cols-2">
                {project.problem && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                    <h3 className="font-semibold text-accent-tint">Problem</h3>
                    <p className="mt-3 leading-relaxed text-gray-300">{project.problem}</p>
                  </div>
                )}
                {project.solution && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                    <h3 className="font-semibold text-accent-tint">Solution</h3>
                    <p className="mt-3 leading-relaxed text-gray-300">{project.solution}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {project.howItWorks.length > 0 && (
            <Section title="How it works">
              <div className="grid gap-4 md:grid-cols-3">
                {project.howItWorks.map((item, index) => (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                    <span className="text-sm font-bold text-accent-soft">{String(index + 1).padStart(2, "0")}</span>
                    <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-400">{item.description}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {project.buildingProcess.length > 0 && (
            <Section title="How I built it">
              <ol className="space-y-6">
                {project.buildingProcess.map((item, index) => (
                  <li key={item.title} className="grid gap-2 sm:grid-cols-[3rem_1fr]">
                    <span className="font-bold text-accent-soft">{index + 1}.</span>
                    <div>
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      <p className="mt-2 leading-relaxed text-gray-300">{item.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {project.challenges.length > 0 && (
            <Section title="Challenges and decisions">
              <div className="space-y-5">
                {project.challenges.map((item) => (
                  <div key={item.challenge} className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                    <h3 className="font-semibold">{item.challenge}</h3>
                    <p className="mt-3 leading-relaxed text-gray-300"><strong className="text-accent-tint">Approach:</strong> {item.solution}</p>
                    {item.lesson && <p className="mt-2 leading-relaxed text-gray-400"><strong>Lesson:</strong> {item.lesson}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Skills and technologies">
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => <SkillLink key={skill.slug} skill={skill} />)}
            </div>
          </Section>

          {project.lessonsLearned.length > 0 && (
            <Section title="What I learned">
              <TextList items={project.lessonsLearned} />
            </Section>
          )}

          {project.outcomes.length > 0 && (
            <Section title="Outcomes">
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {project.outcomes.map((outcome) => (
                  <div key={outcome.label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                    <dt className="text-2xl font-bold">{outcome.value}</dt>
                    <dd className="mt-2 text-sm text-gray-400">{outcome.label}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}
        </div>

        <div className="py-12 text-center">
          <Link href="/projects" className="text-sm font-semibold text-accent-tint underline underline-offset-8">
            Explore all projects
          </Link>
        </div>
      </article>
    </main>
  );
}
