import type { Metadata } from "next";
import Link from "next/link";
import resumeAi from "@/data/resume-ai.json";
import BackNavigationButton from "@/components/BackNavigationButton";
import { getResumeAiData } from "@/lib/content/resume-ai";
import PaperViewport from "@/components/PaperViewport";
import PaperReveal from "@/components/PaperReveal";
import ResumeSheet from "../ResumeSheet";
import DownloadResumeAiButton from "./DownloadResumeAiButton";
import styles from "../resume.module.css";

export const metadata: Metadata = {
  title: "AI/ML Resume",
  description: "The applied machine-learning focused resume of software engineer Saikiran Kalluri.",
  alternates: {
    canonical: "/resume/ai",
  },
  openGraph: {
    title: "AI/ML Resume | Saikiran Kalluri",
    description: "Applied machine-learning experience, projects, and technical skills of software engineer Saikiran Kalluri.",
    url: "/resume/ai",
  },
};


export default function ResumeAiPage() {
  const { internships, projects, skillGroups } = getResumeAiData();
  return (
    <main className={styles.page}>
      <div className={styles.actions}>
        <div className={styles.topRow}>
          <BackNavigationButton className={styles.backLink}>
            ← Back to portfolio
          </BackNavigationButton>
          <DownloadResumeAiButton internships={internships} projects={projects} skillGroups={skillGroups} />
        </div>
        <p className={styles.resumeNote}>
          This is the applied machine-learning focused version of my resume. This is not an embedded PDF —
          it is built from structured JSON and rendered as accessible HTML. For the general software
          engineering resume, see <Link href="/resume">/resume</Link>; for the long form with every role
          and project, see the <Link href="/cv">CV</Link>.
        </p>
      </div>
      <PaperReveal>
      <PaperViewport className={styles.paperFrame}>
        <ResumeSheet
          resume={resumeAi}
          internships={internships}
          projects={projects}
          skillGroups={skillGroups}
          label={`${resumeAi.basics.name} AI/ML resume`}
        />
      </PaperViewport>
      </PaperReveal>
    </main>
  );
}
