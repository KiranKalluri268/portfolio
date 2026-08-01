import Link from "next/link";
import type { ProjectContent } from "@/lib/content/types";

export default function ProjectLink({
  project,
  children,
  className = "",
}: {
  project: ProjectContent;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      className={`rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-soft ${className}`}
    >
      {children ?? project.title}
    </Link>
  );
}
