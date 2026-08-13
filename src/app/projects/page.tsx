import type { Metadata } from "next";
import ProjectsGrid from "@/components/projects/ProjectsGrid";
import ProjectsStack from "@/components/projects/ProjectsStack";
import ProjectsView from "@/components/projects/ProjectsView";
import { getAllProjects } from "@/lib/content/projects";
import { getProjectOrigin, getSkillsForProject } from "@/lib/content/relationships";
import type { ProjectOrigin } from "@/lib/content/relationships";

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

export default function ProjectsPage() {
  const projects = getAllProjects();
  const origins = Object.fromEntries(
    projects.map((project) => [project.slug, getProjectOrigin(project)]),
  ) as Record<string, ProjectOrigin>;
  const stackEntries = projects.map((project) => ({
    project,
    skills: getSkillsForProject(project),
  }));

  return (
    <ProjectsView
      grid={<ProjectsGrid projects={projects} origins={origins} />}
      list={<ProjectsStack entries={stackEntries} />}
    />
  );
}
