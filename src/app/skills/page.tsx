import type { Metadata } from "next";
import SkillsWeb from "@/components/skills/SkillsWeb";
import { buildSkillWebGraph } from "@/components/skills/skill-web-layout";
import { getSkillWebData } from "@/lib/content/skills";

export const metadata: Metadata = {
  title: "Skills",
  description: "Explore an interactive skill universe connecting my software, cloud, DevOps, AI/ML, and creative experience.",
  alternates: { canonical: "/skills" },
  openGraph: {
    title: "Skills | Saikiran Kalluri",
    description: "An interactive map of how I learned and apply technologies across practical software projects.",
    url: "/skills",
  },
};

export default function SkillsPage() {
  const skillWeb = getSkillWebData();
  const graph = buildSkillWebGraph(skillWeb);

  return (
    <main className="relative z-10 h-[100svh] overflow-hidden text-white">
      <h1 className="sr-only">Interactive skills and technology universe</h1>
      <SkillsWeb data={skillWeb} graph={graph} />
    </main>
  );
}
