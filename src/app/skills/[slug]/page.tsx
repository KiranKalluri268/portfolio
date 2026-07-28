import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SkillDetail from "@/components/content/SkillDetail";
import { getProjectsForSkill } from "@/lib/content/relationships";
import { getAllSkillCategories, getAllSkills, getSkillBySlug } from "@/lib/content/skills";

interface SkillPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllSkills().map((skill) => ({ slug: skill.slug }));
}

export async function generateMetadata({ params }: SkillPageProps): Promise<Metadata> {
  const { slug } = await params;
  const skill = getSkillBySlug(slug);
  if (!skill) return {};
  return {
    title: skill.seo.title,
    description: skill.seo.description,
    alternates: { canonical: `/skills/${skill.slug}` },
    openGraph: {
      title: skill.seo.title,
      description: skill.seo.description,
      url: `/skills/${skill.slug}`,
    },
  };
}

export default async function SkillPage({ params }: SkillPageProps) {
  const { slug } = await params;
  const skill = getSkillBySlug(slug);
  if (!skill) notFound();
  const category = getAllSkillCategories().find((item) => item.slug === skill.category);
  if (!category) notFound();
  return (
    <SkillDetail
      skill={skill}
      category={category}
      projects={getProjectsForSkill(skill)}
    />
  );
}
