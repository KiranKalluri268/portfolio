import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProjectDetail from "@/components/content/ProjectDetail";
import { getAllProjects, getProjectBySlug } from "@/lib/content/projects";
import { getSkillsForProject } from "@/lib/content/relationships";
import { getPublicationsForProject } from "@/lib/content/publications";

interface ProjectPageProps {
  params: Promise<{ slug: string }>;
}

// Every page here is generated at build time, so any other address is a 404
// straight away. Without this it was rendered on request, and with a
// loading.tsx streaming ahead of it the 200 was already sent by the time the
// page found there was nothing to show.
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllProjects().map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) return {};
  return {
    title: project.seo.title,
    description: project.seo.description,
    alternates: { canonical: `/projects/${project.slug}` },
    openGraph: {
      title: project.seo.title,
      description: project.seo.description,
      url: `/projects/${project.slug}`,
      ...(project.image
        ? { images: [{ url: project.image, alt: project.imageAlt ?? "" }] }
        : {}),
    },
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();
  return (
    <ProjectDetail
      project={project}
      skills={getSkillsForProject(project)}
      publications={getPublicationsForProject(project.slug)}
    />
  );
}
