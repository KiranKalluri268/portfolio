import Link from "next/link";
import BackNavigationButton from "@/components/BackNavigationButton";
import SkillLink from "./SkillLink";
import type {
  ExperienceContent,
  ExperienceRecommendation,
  ExperienceWorkItem,
  ProjectContent,
  SkillContent,
} from "@/lib/content/types";

const KIND_LABELS: Record<NonNullable<ExperienceWorkItem["kind"]>, string> = {
  feature: "Feature",
  integration: "Integration",
  research: "Research",
  infrastructure: "Infrastructure",
  improvement: "Improvement",
};

/** Case-study titles carry a descriptive subtitle after an en dash, which is
 *  too long to sit inside a sentence. Link text uses the leading name only. */
function shortProjectName(title: string) {
  return title.split(/\s[–—-]\s/)[0].trim();
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/10 py-10 sm:py-14">
      <h2 className="mb-6 text-2xl font-bold sm:text-3xl">{title}</h2>
      {children}
    </section>
  );
}

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

/** The nested timeline of work shipped during the role. Mirrors the homepage
 *  timeline's visual language — a connecting line with glowing nodes — but
 *  runs in a single column so it stays readable on any width. */
function WorkTimeline({
  items,
  skillsBySlug,
  projectsBySlug,
}: {
  items: ExperienceWorkItem[];
  skillsBySlug: Map<string, SkillContent>;
  projectsBySlug: Map<string, ProjectContent>;
}) {
  return (
    <ol className="relative space-y-5">
      {/* Connecting line, inset to pass through the centre of each node. */}
      <span
        className="pointer-events-none absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-accent/70 via-accent-soft/50 to-transparent sm:left-[9px]"
        aria-hidden="true"
      />

      {items.map((item, index) => {
        const project = item.projectSlug ? projectsBySlug.get(item.projectSlug) : undefined;
        const itemSkills = item.skills.flatMap((slug) => {
          const skill = skillsBySlug.get(slug);
          return skill ? [skill] : [];
        });

        return (
          <li key={item.title} className="relative pl-8 sm:pl-10">
            <span
              className="absolute left-0 top-[1.35rem] h-[15px] w-[15px] -translate-y-1/2 rounded-full border border-white/70 bg-accent shadow-[0_0_14px_rgba(224,69,10,0.9)] sm:h-[19px] sm:w-[19px]"
              aria-hidden="true"
            />

            <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-sm p-5 transition-[background-color,border-color] duration-300 hover:border-accent-soft/25 hover:bg-white/5 sm:p-6">
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-sm font-bold text-accent-soft">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {item.kind && (
                  <span className="rounded-full border border-white/15 bg-black/40 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-gray-300">
                    {KIND_LABELS[item.kind]}
                  </span>
                )}
                {item.periodLabel && (
                  <span className="text-xs uppercase tracking-wider text-gray-500">
                    {item.periodLabel}
                  </span>
                )}
              </div>

              <h3 className="text-lg font-semibold sm:text-xl">{item.title}</h3>
              <p className="mt-2 leading-relaxed text-gray-300">{item.description}</p>

              {item.impact && (
                <p className="mt-3 leading-relaxed text-gray-400">
                  <strong className="text-accent-tint">Impact:</strong> {item.impact}
                </p>
              )}

              {itemSkills.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {itemSkills.map((skill) => (
                    <SkillLink key={skill.slug} skill={skill} />
                  ))}
                </div>
              )}

              {project && (
                <Link
                  href={`/projects/${project.slug}`}
                  className="mt-4 inline-flex items-center gap-1.5 rounded text-sm font-semibold text-accent-tint underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-soft"
                >
                  Read the {shortProjectName(project.title)} case study
                  <span aria-hidden="true">→</span>
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** A recommendation from someone who managed the role, quoted verbatim. */
function Recommendation({ recommendation }: { recommendation: ExperienceRecommendation }) {
  return (
    <figure className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/55 backdrop-blur-sm p-6 sm:p-8">
      <span
        className="pointer-events-none absolute -top-6 left-4 select-none font-serif text-8xl leading-none text-accent/15"
        aria-hidden="true"
      >
        &ldquo;
      </span>

      <blockquote className="relative space-y-4 text-base leading-relaxed text-gray-200 sm:text-lg">
        {recommendation.quote.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </blockquote>

      <figcaption className="mt-6 border-t border-white/10 pt-5">
        <span className="block font-semibold text-white">{recommendation.author}</span>
        <span className="mt-1 block text-sm text-accent-soft">{recommendation.authorTitle}</span>
        <span className="mt-2 block text-xs uppercase tracking-wider text-gray-500">
          {recommendation.relationship}
          {recommendation.relationship && recommendation.dateLabel && (
            <span aria-hidden="true"> · </span>
          )}
          {recommendation.dateLabel && (
            recommendation.date ? (
              <time dateTime={recommendation.date}>{recommendation.dateLabel}</time>
            ) : (
              recommendation.dateLabel
            )
          )}
        </span>
        {recommendation.sourceUrl && (
          <a
            href={recommendation.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded text-sm font-semibold text-accent-tint underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-soft"
          >
            {recommendation.sourceLabel}
            <span aria-hidden="true">↗</span>
          </a>
        )}
      </figcaption>
    </figure>
  );
}

export default function ExperienceDetail({
  experience,
  skills,
  projects,
}: {
  experience: ExperienceContent;
  skills: SkillContent[];
  projects: ProjectContent[];
}) {
  const skillsBySlug = new Map(skills.map((skill) => [skill.slug, skill]));
  const projectsBySlug = new Map(projects.map((project) => [project.slug, project]));

  return (
    <main className="relative z-10 min-h-[100svh] px-4 pt-24 pb-8 text-white sm:px-6 sm:pt-28 sm:pb-12">
      <article className="mx-auto max-w-5xl">
        <BackNavigationButton className="mb-10 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-sm text-gray-200 backdrop-blur-md transition-colors hover:border-accent-soft/40 hover:text-white">
          <span aria-hidden="true">←</span> Back
        </BackNavigationButton>

        <header className="mb-10 max-w-4xl sm:mb-14">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent-soft">
            Experience{experience.employmentType ? ` · ${experience.employmentType}` : ""}
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            {experience.role}
          </h1>
          <p className="mt-3 text-xl font-medium text-accent-soft sm:text-2xl">
            {experience.companyUrl ? (
              <a
                href={experience.companyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-soft"
              >
                {experience.company} <span aria-hidden="true">↗</span>
              </a>
            ) : (
              experience.company
            )}
          </p>
          <p className="mt-6 text-lg leading-relaxed text-gray-300 sm:text-xl">
            {experience.summary}
          </p>

          <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-gray-500">Period</dt>
              <dd className="mt-1 text-gray-200">
                <time dateTime={experience.period.startDate}>
                  {experience.period.startLabel}
                </time>
                <span aria-hidden="true"> – </span>
                {experience.period.endDate ? (
                  <time dateTime={experience.period.endDate}>{experience.period.endLabel}</time>
                ) : (
                  <span>{experience.period.endLabel}</span>
                )}
              </dd>
            </div>
            {experience.location && (
              <div>
                <dt className="text-xs uppercase tracking-wider text-gray-500">Location</dt>
                <dd className="mt-1 text-gray-200">{experience.location}</dd>
              </div>
            )}
            {experience.workMode && (
              <div>
                <dt className="text-xs uppercase tracking-wider text-gray-500">Work mode</dt>
                <dd className="mt-1 text-gray-200">{experience.workMode}</dd>
              </div>
            )}
          </dl>
        </header>

        <div className="rounded-3xl border border-white/10 bg-black/60 px-6 backdrop-blur-md sm:px-10">
          {experience.overview.length > 0 && (
            <Section title="About the role">
              <div className="max-w-4xl space-y-4 text-base leading-relaxed text-gray-300 sm:text-lg">
                {experience.overview.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </Section>
          )}

          {experience.workItems.length > 0 && (
            <Section title="What I worked on">
              <WorkTimeline
                items={experience.workItems}
                skillsBySlug={skillsBySlug}
                projectsBySlug={projectsBySlug}
              />
            </Section>
          )}

          {experience.recommendations.length > 0 && (
            <Section
              title={
                experience.recommendations.length === 1 ? "Recommendation" : "Recommendations"
              }
            >
              <div className="space-y-6">
                {experience.recommendations.map((recommendation) => (
                  <Recommendation key={recommendation.author} recommendation={recommendation} />
                ))}
              </div>
            </Section>
          )}

          {experience.highlights.length > 0 && (
            <Section title="Highlights">
              <TextList items={experience.highlights} />
            </Section>
          )}

          {skills.length > 0 && (
            <Section title="Skills and technologies">
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <SkillLink key={skill.slug} skill={skill} />
                ))}
              </div>
            </Section>
          )}

          {experience.lessonsLearned.length > 0 && (
            <Section title="What I learned">
              <TextList items={experience.lessonsLearned} />
            </Section>
          )}

          {experience.outcomes.length > 0 && (
            <Section title="Outcomes">
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {experience.outcomes.map((outcome) => (
                  <div
                    key={outcome.label}
                    className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-sm p-5"
                  >
                    <dt className="text-2xl font-bold">{outcome.value}</dt>
                    <dd className="mt-2 text-sm text-gray-400">{outcome.label}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}
        </div>

        <div className="py-12 text-center">
          <Link
            href="/#experience"
            className="text-sm font-semibold text-accent-tint underline underline-offset-8"
          >
            Back to the experience timeline
          </Link>
        </div>
      </article>
    </main>
  );
}
