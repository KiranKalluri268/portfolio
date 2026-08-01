import ProjectLink from "./ProjectLink";
import ProjectThumbnail from "./ProjectThumbnail";
import type { ProjectContent } from "@/lib/content/types";

export default function ProjectCard({ project }: { project: ProjectContent }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] transition-colors hover:border-accent-soft/30">
      <ProjectLink project={project} className="block">
        <div className="relative aspect-[16/9] overflow-hidden bg-white/[0.025]">
          <ProjectThumbnail
            project={project}
            sizes="(max-width: 768px) calc(100vw - 3rem), 30vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.025]"
          />
        </div>
        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-soft">
            {project.role}
          </p>
          <h3 className="mt-2 text-xl font-bold text-white">{project.title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-gray-400">{project.summary}</p>
          <span className="mt-4 inline-block text-sm font-semibold text-accent-tint">
            Read case study <span aria-hidden="true">→</span>
          </span>
        </div>
      </ProjectLink>
    </article>
  );
}
