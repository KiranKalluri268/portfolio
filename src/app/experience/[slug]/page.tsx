import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ExperienceDetail from "@/components/content/ExperienceDetail";
import { getAllExperiences, getExperienceBySlug } from "@/lib/content/experience";
import {
  getProjectsForExperience,
  getSkillsForExperience,
} from "@/lib/content/relationships";

interface ExperiencePageProps {
  params: Promise<{ slug: string }>;
}

// Every page here is generated at build time, so any other address is a 404
// straight away. Without this it was rendered on request, and with a
// loading.tsx streaming ahead of it the 200 was already sent by the time the
// page found there was nothing to show.
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllExperiences().map((experience) => ({ slug: experience.slug }));
}

export async function generateMetadata({ params }: ExperiencePageProps): Promise<Metadata> {
  const { slug } = await params;
  const experience = getExperienceBySlug(slug);
  if (!experience) return {};
  return {
    title: experience.seo.title,
    description: experience.seo.description,
    alternates: { canonical: `/experience/${experience.slug}` },
    openGraph: {
      title: experience.seo.title,
      description: experience.seo.description,
      url: `/experience/${experience.slug}`,
    },
  };
}

export default async function ExperiencePage({ params }: ExperiencePageProps) {
  const { slug } = await params;
  const experience = getExperienceBySlug(slug);
  if (!experience) notFound();
  return (
    <ExperienceDetail
      experience={experience}
      skills={getSkillsForExperience(experience)}
      projects={getProjectsForExperience(experience)}
    />
  );
}
