import type { Metadata } from "next";
import BackNavigationButton from "@/components/BackNavigationButton";
import SkillsWeb from "@/components/skills/SkillsWeb";
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

  return (
    <main className="relative z-10 h-[100svh] overflow-hidden text-white">
      <div className="absolute left-4 top-4 z-[60] sm:left-6 sm:top-6">
        <BackNavigationButton className="rounded-full border border-white/15 bg-black/70 px-4 py-2 text-sm text-gray-200 shadow-xl backdrop-blur-xl transition-colors hover:border-blue-400/40 hover:text-white">
          <span aria-hidden="true">←</span> Back to portfolio
        </BackNavigationButton>
      </div>
      <h1 className="sr-only">Interactive skills and technology universe</h1>
      <SkillsWeb data={skillWeb} />
    </main>
  );
}
