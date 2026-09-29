import type { ProjectContent } from "./types";

type ProjectLinkFields = Pick<ProjectContent, "landingPageUrl" | "appUrl" | "liveUrl">;

export function getProjectActionLinks(project: ProjectLinkFields) {
  const links: Array<{ label: string; url: string }> = [];

  if (project.landingPageUrl) {
    links.push({ label: "Landing page", url: project.landingPageUrl });
  }
  if (project.appUrl) {
    links.push({ label: "Open app", url: project.appUrl });
  }
  if (links.length === 0 && project.liveUrl) {
    links.push({ label: "Live project", url: project.liveUrl });
  }

  return links;
}
