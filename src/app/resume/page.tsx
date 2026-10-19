import type { Metadata } from "next";
import Link from "next/link";
import resume from "@/data/resume.json";
import BackNavigationButton from "@/components/BackNavigationButton";
import { getResumeData } from "@/lib/content/resume";
import PaperViewport from "@/components/PaperViewport";
import PaperReveal from "@/components/PaperReveal";
import ResumeSheet from "./ResumeSheet";
import DownloadResumeButton from "./DownloadResumeButton";
import styles from "./resume.module.css";

export const metadata: Metadata = {
  title: "Resume",
  description: "View and download the professional resume of software engineer Saikiran Kalluri.",
  alternates: {
    canonical: "/resume",
  },
  openGraph: {
    title: "Resume | Saikiran Kalluri",
    description: "Experience, projects, and technical skills of software engineer Saikiran Kalluri.",
    url: "/resume",
  },
};


export default function ResumePage() {
  const { internships, projects, skillGroups } = getResumeData();
  return (
    <main className={styles.page}>
      <div className={styles.actions}>
        <div className={styles.topRow}>
          <BackNavigationButton className={styles.backLink}>
            ← Back to portfolio
          </BackNavigationButton>
          <DownloadResumeButton internships={internships} projects={projects} skillGroups={skillGroups} />
        </div>
        <p className={styles.resumeNote}>
          This is not an embedded PDF. The resume is built from structured JSON and rendered as accessible HTML.
          For the long form with every role and project, see the <Link href="/cv">CV</Link>.
        </p>
      </div>
      <PaperReveal>
      <PaperViewport className={styles.paperFrame}>
        <ResumeSheet
          resume={resume}
          internships={internships}
          projects={projects}
          skillGroups={skillGroups}
          label={`${resume.basics.name} resume`}
        />
      </PaperViewport>
      </PaperReveal>
    </main>
  );
}
