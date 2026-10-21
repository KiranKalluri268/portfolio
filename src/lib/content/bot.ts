import "server-only";

import faq from "@/data/faq.json";
import hero from "@/data/hero.json";
import resume from "@/data/resume.json";
import type { BotKnowledge } from "@/components/bot/tars-brain";
import { getAllExperiences } from "./experience";
import { getAllProjects } from "./projects";
import { getProjectsForSkill, getSkillsForProject } from "./relationships";
import { getAllSkillCategories, getAllSkills, getSkillWebConfig } from "./skills";

/** Everything TARS can say, gathered from the same content files the pages
 *  read, so the two cannot disagree. Published content only. */
export function getBotKnowledge(): BotKnowledge {
  const categories = new Map(getAllSkillCategories().map((category) => [category.slug, category.label]));
  const firstName = resume.basics.name.split(" ")[0];
  const skills = getAllSkills();

  return {
    name: firstName.charAt(0) + firstName.slice(1).toLowerCase(),
    headline: resume.basics.headline,
    location: resume.basics.location,
    availability: hero.availability,
    email: resume.basics.email,
    profiles: resume.basics.links
      .filter((link) => /linkedin|github/i.test(link.url))
      .map((link) => ({ label: /linkedin/i.test(link.url) ? "LinkedIn" : "GitHub", href: link.url })),
    education: {
      degree: resume.education.degree,
      institution: resume.education.institution,
      period: resume.education.period,
      cgpa: resume.education.cgpa,
    },
    faq: faq.map(({ id, question, answer }) => ({ id, question, answer })),
    projects: getAllProjects().map((project) => ({
      slug: project.slug,
      title: project.title,
      summary: project.summary,
      skills: getSkillsForProject(project).map((skill) => skill.name),
      featured: project.showInProjectsSection,
    })),
    roles: getAllExperiences()
      .sort((a, b) => a.timelineOrder - b.timelineOrder)
      .map((experience) => ({
        slug: experience.slug,
        role: experience.role,
        company: experience.company,
        period: experience.resumePeriod,
        summary: experience.summary,
      })),
    skills: skills.map((skill) => ({
      slug: skill.slug,
      name: skill.name,
      category: categories.get(skill.category) ?? skill.category,
      projects: getProjectsForSkill(skill).map((project) => project.title),
    })),
    areas: getSkillWebConfig().domains.flatMap((domain) => [
      {
        label: domain.label,
        skills: skills
          .filter((skill) => domain.categories.some((category) => category.slug === skill.webCategory))
          .map((skill) => skill.name),
      },
      ...domain.categories.map((category) => ({
        label: category.label,
        skills: skills.filter((skill) => skill.webCategory === category.slug).map((skill) => skill.name),
      })),
    ]),
  };
}
