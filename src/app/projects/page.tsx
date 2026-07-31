import type { Metadata } from "next";
import Link from "next/link";
import BackNavigationButton from "@/components/BackNavigationButton";
import ProjectLink from "@/components/content/ProjectLink";
import ProjectThumbnail from "@/components/content/ProjectThumbnail";
import SkillLink from "@/components/content/SkillLink";
import { getAllProjects } from "@/lib/content/projects";
import { getSkillsForProject } from "@/lib/content/relationships";
import type { ProjectContent, SkillContent } from "@/lib/content/types";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Explore full-stack, AI, cloud, and mobile projects built by software engineer Saikiran Kalluri.",
  alternates: {
    canonical: "/projects",
  },
  openGraph: {
    title: "Projects | Saikiran Kalluri",
    description:
      "Case studies covering full-stack systems, applied AI, cloud infrastructure, and mobile development.",
    url: "/projects",
  },
};

function ProjectLinks({ project }: { project: ProjectContent }) {
  const links = [
    project.repositoryUrl
      ? { label: "View source", shortLabel: "Source", href: project.repositoryUrl }
      : null,
    project.liveUrl
      ? { label: "Open live project", shortLabel: "Live project", href: project.liveUrl }
      : null,
  ].filter((link): link is { label: string; shortLabel: string; href: string } => link !== null);

  return (
    <div>
      <nav className="flex flex-nowrap gap-2 sm:flex-wrap sm:gap-3" aria-label={`Links for ${project.title}`}>
        <ProjectLink
          project={project}
          className="flex-1 whitespace-nowrap rounded-full border border-white/20 bg-white px-3 py-2 text-center text-xs font-semibold text-black transition-colors hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-soft sm:flex-none sm:px-5 sm:py-2.5 sm:text-sm"
        >
          Read case study <span aria-hidden="true">→</span>
        </ProjectLink>
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 whitespace-nowrap rounded-full border border-white/20 bg-black/45 px-3 py-2 text-center text-xs font-semibold text-white transition-colors hover:border-accent-soft/60 hover:text-accent-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-soft sm:flex-none sm:px-5 sm:py-2.5 sm:text-sm"
          >
            <span className="sm:hidden">{link.shortLabel}</span>
            <span className="hidden sm:inline">{link.label}</span>{" "}
            <span aria-hidden="true">↗</span>
          </a>
        ))}
      </nav>
      {links.length === 0 && (
        <p className="mt-3 text-sm text-gray-500">Public repository and demo links are not available for this project.</p>
      )}
    </div>
  );
}

function TechnologyList({ skills }: { skills: SkillContent[] }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Technologies used">
      {skills.map((skill) => (
        <li key={skill.slug}>
          <SkillLink skill={skill} className="text-xs sm:text-sm" />
        </li>
      ))}
    </ul>
  );
}

function FeaturedProject({
  project,
  skills,
  index,
}: {
  project: ProjectContent;
  skills: SkillContent[];
  index: number;
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-black/60 shadow-2xl backdrop-blur-md">
      <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <ProjectLink project={project} className={`relative block min-h-64 overflow-hidden sm:min-h-80 lg:min-h-[34rem] ${index % 2 === 1 ? "lg:order-2" : ""}`}>
            <ProjectThumbnail
              project={project}
              priority={index === 0}
              sizes="(max-width: 1024px) calc(100vw - 2rem), 52vw"
              className="object-cover transition-transform duration-700 hover:scale-[1.025]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent lg:bg-gradient-to-r" />
        </ProjectLink>

        <div className="flex flex-col justify-center gap-6 p-6 sm:p-9 lg:p-12">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-accent-soft">
              Featured case study · {project.role}
            </p>
            <h2 className="text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
              <ProjectLink project={project} className="hover:text-accent-soft">{project.title}</ProjectLink>
            </h2>
          </div>

          <p className="leading-relaxed text-gray-300">{project.summary}</p>
          <TechnologyList skills={skills} />

          <ul className="space-y-3 text-sm leading-relaxed text-gray-300 sm:text-base">
            {project.highlights.map((highlight) => (
              <li key={highlight} className="flex gap-3">
                <span className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-soft" aria-hidden="true" />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>

          {project.outcomes.length > 0 && (
            <dl className="grid grid-cols-2 gap-3">
              {project.outcomes.map((outcome) => (
                <div key={outcome.label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <dt className="text-lg font-bold text-white sm:text-xl">{outcome.value}</dt>
                  <dd className="mt-1 text-xs leading-relaxed text-gray-400 sm:text-sm">{outcome.label}</dd>
                </div>
              ))}
            </dl>
          )}

          <ProjectLinks project={project} />
        </div>
      </div>
    </article>
  );
}

function AdditionalProject({ project, skills }: { project: ProjectContent; skills: SkillContent[] }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-black/60 backdrop-blur-md transition-colors duration-300 hover:border-accent-soft/25">
      <ProjectLink project={project} className="relative block aspect-[16/9] overflow-hidden bg-white/[0.025]">
        <ProjectThumbnail
          project={project}
          sizes="(max-width: 768px) calc(100vw - 2rem), 33vw"
          className={project.id === 4 ? "object-contain" : "object-cover"}
        />
      </ProjectLink>
      <div className="flex flex-1 flex-col gap-5 p-6 sm:p-7">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent-soft">{project.role}</p>
          <h3 className="text-xl font-bold sm:text-2xl">
            <ProjectLink project={project} className="hover:text-accent-soft">{project.title}</ProjectLink>
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-gray-300 sm:text-base">{project.summary}</p>
        <TechnologyList skills={skills} />
        <ul className="space-y-2 text-sm leading-relaxed text-gray-400">
          {project.highlights.map((highlight) => (
            <li key={highlight} className="flex gap-3">
              <span className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-soft" aria-hidden="true" />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-2">
          <ProjectLinks project={project} />
        </div>
      </div>
    </article>
  );
}

export default function ProjectsPage() {
  const projects = getAllProjects();
  const featured = projects.filter((project) => project.featured);
  const additional = projects.filter((project) => !project.featured);

  return (
    <main className="relative z-10 min-h-[100svh] overflow-hidden px-4 py-8 text-white sm:px-6 sm:py-12 lg:px-10">
      <div className="mx-auto w-full max-w-7xl">
        <BackNavigationButton className="mb-14 cursor-pointer rounded-full border border-white/15 bg-black/55 px-4 py-2 text-sm text-gray-200 backdrop-blur-md transition-colors hover:border-accent-soft/40 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-soft sm:mb-20">
          <span aria-hidden="true">←</span> Back to portfolio
        </BackNavigationButton>

        <header className="mb-14 max-w-4xl sm:mb-20">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-accent-soft">Selected work</p>
          <h1 className="text-4xl font-bold leading-none tracking-tight sm:text-6xl lg:text-7xl">
            Projects &amp; case studies
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-gray-300 sm:text-lg">
            A selection of products and experiments spanning full-stack systems, applied AI, cloud infrastructure, and mobile development.
          </p>
        </header>

        <section className="space-y-8 sm:space-y-12" aria-labelledby="featured-projects-heading">
          <h2 id="featured-projects-heading" className="sr-only">Featured projects</h2>
          {featured.map((project, index) => (
            <FeaturedProject
              key={project.id}
              project={project}
              skills={getSkillsForProject(project)}
              index={index}
            />
          ))}
        </section>

        <section className="py-20 sm:py-28" aria-labelledby="additional-projects-heading">
          <div className="mb-8 sm:mb-12">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-accent-soft">More experiments</p>
            <h2 id="additional-projects-heading" className="text-3xl font-bold sm:text-4xl">Additional projects</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {additional.map((project) => (
              <AdditionalProject
                key={project.id}
                project={project}
                skills={getSkillsForProject(project)}
              />
            ))}
          </div>
        </section>

        <section className="mb-12 rounded-3xl border border-white/10 bg-black/60 px-6 py-10 text-center backdrop-blur-md sm:px-10 sm:py-14">
          <h2 className="text-2xl font-bold sm:text-3xl">Interested in the work behind these projects?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base">
            View my experience and technical background, or get in touch to discuss a project, role, or collaboration.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/resume" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-soft">
              View résumé
            </Link>
            <Link href="/#contact" className="rounded-full border border-white/20 bg-black/45 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:border-accent-soft/60 hover:text-accent-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-soft">
              Contact me
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
