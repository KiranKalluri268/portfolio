import "server-only";

import resume from "@/data/resume.json";
import { getAllExperiences } from "./experience";
import { getAllProjects } from "./projects";
import { getAllSkillCategories, getAllSkills } from "./skills";
import type {
  CvData,
  CvProject,
  CvRole,
  CvSkillGroup,
  ExperienceContent,
  ProjectContent,
  SkillContent,
} from "./types";

/** Human-readable period, e.g. "August 2025 – January 2026". */
function formatPeriod(experience: ExperienceContent) {
  return `${experience.period.startLabel} – ${experience.period.endLabel}`;
}

/** Resolves skill slugs to display names, dropping any that no longer exist so
 *  the CV degrades to a shorter list rather than failing to render. */
function toNames(slugs: string[], bySlug: Map<string, SkillContent>) {
  return slugs.flatMap((slug) => {
    const skill = bySlug.get(slug);
    return skill ? [skill.name] : [];
  });
}

function toCvRole(
  experience: ExperienceContent,
  skillsBySlug: Map<string, SkillContent>,
  projectsBySlug: Map<string, ProjectContent>,
): CvRole {
  return {
    slug: experience.slug,
    role: experience.role,
    company: experience.company,
    employmentType: experience.employmentType,
    period: formatPeriod(experience),
    location: experience.location,
    workMode: experience.workMode,
    summary: experience.summary,
    workItems: experience.workItems.map((item) => ({
      title: item.title,
      description: item.description,
      kind: item.kind,
      impact: item.impact,
      technologies: toNames(item.skills, skillsBySlug),
      projectTitle: item.projectSlug
        ? projectsBySlug.get(item.projectSlug)?.title
        : undefined,
    })),
    technologies: toNames(experience.skills, skillsBySlug),
  };
}

function toCvProject(
  project: ProjectContent,
  skillsBySlug: Map<string, SkillContent>,
): CvProject {
  return {
    slug: project.slug,
    title: project.title,
    role: project.role,
    summary: project.summary,
    highlights: project.highlights,
    outcomes: project.outcomes,
    technologies: toNames(project.skills, skillsBySlug),
    repositoryUrl: project.repositoryUrl,
    liveUrl: project.liveUrl,
  };
}

function buildSkillGroups(skills: SkillContent[]): CvSkillGroup[] {
  return getAllSkillCategories()
    .map((category) => ({
      label: category.label,
      skills: skills
        .filter((skill) => skill.category === category.slug)
        .map((skill) => ({ name: skill.name, shortDescription: skill.shortDescription })),
    }))
    .filter((group) => group.skills.length > 0);
}

/** Everything the CV renders, in one serializable payload. */
export function getCvData(): CvData {
  const skills = getAllSkills();
  const skillsBySlug = new Map(skills.map((skill) => [skill.slug, skill]));
  const projects = getAllProjects();
  const projectsBySlug = new Map(projects.map((project) => [project.slug, project]));
  const experiences = getAllExperiences();

  // Work built during a role is already described under that role, so listing
  // it again under Projects repeats it almost word for word. The Projects
  // section is therefore the independent work only.
  const employmentProjects = new Set(
    experiences.flatMap((experience) =>
      experience.workItems.flatMap((item) => (item.projectSlug ? [item.projectSlug] : [])),
    ),
  );

  return {
    basics: resume.basics,
    profile: resume.objective,
    roles: experiences.map((experience) =>
      toCvRole(experience, skillsBySlug, projectsBySlug),
    ),
    projects: projects
      .filter((project) => !employmentProjects.has(project.slug))
      .map((project) => toCvProject(project, skillsBySlug)),
    skillGroups: buildSkillGroups(skills),
    education: resume.education,
    certifications: resume.certifications,
    languages: resume.languages,
    strengths: resume.strengths,
  };
}
