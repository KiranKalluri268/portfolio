import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import resumeAi from "@/data/resume-ai.json";
import BackNavigationButton from "@/components/BackNavigationButton";
import { getResumeAiData } from "@/lib/content/resume-ai";
import PaperViewport from "@/components/PaperViewport";
import PaperReveal from "@/components/PaperReveal";
import { REVEAL_LEAD_IN_MS, RESUME_STEP_MS, revealProps } from "@/components/paper-reveal";
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

/** Reading order, and the only place it is written down. The header is the
 *  first piece to land and the footer the last; everything between is a
 *  section, in the order it appears on the sheet. */
function landsAt(order: number) {
  return revealProps(REVEAL_LEAD_IN_MS + order * RESUME_STEP_MS);
}

function Section({ title, order, children }: { title: string; order: number; children: ReactNode }) {
  return (
    <section className={styles.section} {...landsAt(order)}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

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
        <article className={styles.paper} aria-label={`${resumeAi.basics.name} AI/ML resume`}>
        <header {...landsAt(0)}>
          <h1 className={styles.name}>{resumeAi.basics.name}</h1>
          <p className={styles.headline}>{resumeAi.basics.headline}</p>
          <p className={styles.contactLine}>
            {resumeAi.basics.location} <span className={styles.separator}>|</span>{" "}
            <a className={styles.contactLink} href={`tel:${resumeAi.basics.phone.replace(/[^+\d]/g, "")}`}>
              {resumeAi.basics.phone}
            </a>{" "}
            <span className={styles.separator}>|</span>{" "}
            <a className={styles.contactLink} href={`mailto:${resumeAi.basics.email}`}>
              {resumeAi.basics.email}
            </a>
          </p>
          <p className={styles.links}>
            {resumeAi.basics.links.map((link, index) => (
              <span key={link.url}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
                {index < resumeAi.basics.links.length - 1 && (
                  <> <span className={styles.separator}>|</span>{" "}</>
                )}
              </span>
            ))}
          </p>
        </header>

        <Section title="Summary" order={1}>
          <p className={styles.paragraph}>{resumeAi.objective}</p>
        </Section>

        <Section title="Core Skills" order={2}>
          {skillGroups.map((skill) => (
            <p className={styles.skill} key={skill.category}>
              <span className={styles.skillLabel}>{skill.category}:</span>{" "}
              {skill.items.join(", ")}
            </p>
          ))}
        </Section>

        <Section title="Internships" order={3}>
          {internships.map((internship) => (
            <div key={`${internship.company}-${internship.role}`}>
              <h3 className={styles.entryTitle}>
                {internship.role} – {internship.company}{" "}
                <span className={styles.period}>({internship.period})</span>
              </h3>
              <ul className={styles.list}>
                {internship.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
              </ul>
            </div>
          ))}
        </Section>

        <Section title="Projects" order={4}>
          {projects.map((project) => (
            <div key={project.slug}>
              <h3 className={styles.entryTitle}>
                {project.name}{" "}
                <span className={styles.technologies}>({project.technologies})</span>
              </h3>
              <ul className={styles.list}>
                {project.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
              </ul>
            </div>
          ))}
        </Section>

        <Section title="Education" order={5}>
          <p className={styles.education}>
            {resumeAi.education.degree} <span className={styles.separator}>|</span>{" "}
            {resumeAi.education.institution} <span className={styles.separator}>|</span>{" "}
            {resumeAi.education.period} <span className={styles.separator}>|</span>{" "}
            <span className={styles.noBreak}>CGPA: {resumeAi.education.cgpa}</span>
          </p>
        </Section>

        <div className={styles.footer} {...landsAt(6)}>
          <p className={styles.footerLine}>
            <span className={styles.footerLabel}>Languages:</span> {resumeAi.languages.join(", ")}{" "}
            <span className={styles.separator}>|</span>{" "}
            <span className={styles.footerLabel}>Strengths:</span> {resumeAi.strengths.join(", ")}
          </p>
        </div>
        </article>
      </PaperViewport>
      </PaperReveal>
    </main>
  );
}
