import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import resume from "@/data/resume.json";
import BackNavigationButton from "@/components/BackNavigationButton";
import { getResumeData } from "@/lib/content/resume";
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

export default function ResumePage() {
  const { internships, projects, skillGroups } = getResumeData();
  return (
    <main className={styles.page}>
      <div className={styles.actions}>
        <div className={styles.actionCopy}>
          <BackNavigationButton className={styles.backLink}>
            ← Back to portfolio
          </BackNavigationButton>
          <p className={styles.resumeNote}>
            This is not an embedded PDF. The resume is built from structured JSON and rendered as accessible HTML.
            For the long form with every role and project, see the <Link href="/cv">CV</Link>.
          </p>
        </div>
        <DownloadResumeButton internships={internships} projects={projects} skillGroups={skillGroups} />
      </div>
      <article className={styles.paper} aria-label={`${resume.basics.name} resume`}>
        <header>
          <h1 className={styles.name}>{resume.basics.name}</h1>
          <p className={styles.contactLine}>
            {resume.basics.location} <span className={styles.separator}>|</span>{" "}
            <a className={styles.contactLink} href={`tel:${resume.basics.phone.replace(/[^+\d]/g, "")}`}>
              {resume.basics.phone}
            </a>{" "}
            <span className={styles.separator}>|</span>{" "}
            <a className={styles.contactLink} href={`mailto:${resume.basics.email}`}>
              {resume.basics.email}
            </a>
          </p>
          <p className={styles.links}>
            {resume.basics.links.map((link, index) => (
              <span key={link.url}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
                {index < resume.basics.links.length - 1 && (
                  <> <span className={styles.separator}>|</span>{" "}</>
                )}
              </span>
            ))}
          </p>
        </header>

        <Section title="Objective">
          <p className={styles.paragraph}>{resume.objective}</p>
        </Section>

        <Section title="Core Skills">
          {skillGroups.map((skill) => (
            <p className={styles.skill} key={skill.category}>
              <span className={styles.skillLabel}>{skill.category}:</span>{" "}
              {skill.items.join(", ")}
            </p>
          ))}
        </Section>

        <Section title="Projects">
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

        <Section title="Internships">
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

        <Section title="Education">
          <p className={styles.education}>
            {resume.education.degree} <span className={styles.separator}>|</span>{" "}
            {resume.education.institution} <span className={styles.separator}>|</span>{" "}
            {resume.education.period} <span className={styles.separator}>|</span>{" "}
            CGPA: {resume.education.cgpa}
          </p>
        </Section>

        <Section title="Certifications">
          <ul className={styles.list}>
            {resume.certifications.map((certification) => (
              <li key={certification}>{certification}</li>
            ))}
          </ul>
        </Section>

        <div className={styles.footer}>
          <p className={styles.footerLine}>
            <span className={styles.footerLabel}>Languages:</span> {resume.languages.join(", ")}{" "}
            <span className={styles.separator}>|</span>{" "}
            <span className={styles.footerLabel}>Strengths:</span> {resume.strengths.join(", ")}
          </p>
        </div>
      </article>
    </main>
  );
}
