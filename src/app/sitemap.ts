import type { MetadataRoute } from "next";
import { getAllExperiences } from "@/lib/content/experience";
import { getAllProjects } from "@/lib/content/projects";
import { getAllSkills } from "@/lib/content/skills";

const SITE_URL = "https://saikirankalluri.dev";

export default function sitemap(): MetadataRoute.Sitemap {
    const lastModified = new Date();
    return [
        {
            url: SITE_URL,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 1,
        },
        {
            url: `${SITE_URL}/resume`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.8,
        },
        {
            url: `${SITE_URL}/cv`,
            lastModified,
            changeFrequency: "monthly",
            priority: 0.7,
        },
        {
            url: `${SITE_URL}/projects`,
            lastModified,
            changeFrequency: "monthly",
            priority: 0.9,
        },
        {
            url: `${SITE_URL}/skills`,
            lastModified,
            changeFrequency: "monthly",
            priority: 0.8,
        },
        ...getAllProjects().map((project) => ({
            url: `${SITE_URL}/projects/${project.slug}`,
            lastModified,
            changeFrequency: "monthly" as const,
            priority: 0.8,
        })),
        ...getAllSkills().map((skill) => ({
            url: `${SITE_URL}/skills/${skill.slug}`,
            lastModified,
            changeFrequency: "monthly" as const,
            priority: 0.7,
        })),
        ...getAllExperiences().map((experience) => ({
            url: `${SITE_URL}/experience/${experience.slug}`,
            lastModified,
            changeFrequency: "monthly" as const,
            priority: 0.7,
        })),
    ];
}
