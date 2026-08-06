import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import BackNavigationButton from "@/components/BackNavigationButton";
import { getCvData } from "@/lib/content/cv";
import type { CvProject, CvRole } from "@/lib/content/types";
import PaperViewport from "@/components/PaperViewport";
import PaperReveal from "@/components/PaperReveal";
import CvPages, { type CvBlock } from "./CvPages";
import DownloadCvButton from "./DownloadCvButton";
import styles from "./cv.module.css";

export const metadata: Metadata = {
  title: "CV",
  description:
    "The full curriculum vitae of software engineer Saikiran Kalluri: every role, the work shipped in each, project case studies, and technical skills.",
  alternates: { canonical: "/cv" },
  openGraph: {
    title: "CV | Saikiran Kalluri",
    description:
      "A detailed, multi-page curriculum vitae covering experience, work shipped, projects, and skills.",
    url: "/cv",
  },
};

/** A section as flat blocks: its heading, then each of its entries. The
 *  paginator needs to break between them, which it cannot do while they are
 *  wrapped in one element. An unnamed <section> is not exposed as a landmark
 *  anyway, so the heading outline still carries the structure. */
function sectionBlocks(title: string, entries: { id: string; node: ReactNode }[]): CvBlock[] {
  if (entries.length === 0) return [];
  return [
    {
      id: `heading-${title}`,
      keepWithNext: true,
      node: <h2 className={styles.sectionTitle}>{title}</h2>,
    },
    ...entries,
  ];
}

function TechLine({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <p className={styles.techLine}>
      <span className={styles.techLabel}>{label}:</span> {items.join(" · ")}
    </p>
  );
}

function RoleEntry({ role }: { role: CvRole }) {
  return (
    <article className={styles.entry}>
      <div className={styles.entryHeader}>
        <h3 className={styles.entryTitle}>{role.role}</h3>
        <span className={styles.entryMeta}>{role.period}</span>
      </div>
      <p className={styles.entrySubtitle}>
        {role.company}
        {role.employmentType && (
          <>
            {" "}
            <span className={styles.separator}>|</span> {role.employmentType}
          </>
        )}
        {role.location && (
          <>
            {" "}
            <span className={styles.separator}>|</span> {role.location}
            {role.workMode && role.workMode !== role.location ? ` (${role.workMode})` : ""}
          </>
        )}
      </p>

      <p className={`${styles.paragraph} ${styles.summary}`}>{role.summary}</p>

      {role.workItems.length > 0 && (
        <>
          <h4 className={styles.subheading}>What I worked on</h4>
          {role.workItems.map((item) => (
            <div className={styles.workItem} key={item.title}>
              <p className={styles.workItemTitle}>
                {item.title}
                {item.kind && <span className={styles.kind}>{item.kind}</span>}
              </p>
              <p className={styles.workItemBody}>{item.description}</p>
              {item.impact && (
                <p className={styles.impact}>
                  <strong>Impact:</strong> {item.impact}
                </p>
              )}
              {item.projectTitle && (
                <p className={styles.techLine}>
                  <span className={styles.techLabel}>Project:</span> {item.projectTitle}
                </p>
              )}
              <TechLine label="Technologies" items={item.technologies} />
            </div>
          ))}
        </>
      )}

    </article>
  );
}

function ProjectEntry({ project }: { project: CvProject }) {
  return (
    <article className={styles.entry}>
      <div className={styles.entryHeader}>
        <h3 className={styles.entryTitle}>{project.title}</h3>
        <span className={styles.entryMeta}>{project.role}</span>
      </div>

      <p className={`${styles.paragraph} ${styles.summary}`}>{project.summary}</p>

      {project.highlights.length > 0 && (
        <ul className={styles.list}>
          {project.highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      )}

      {project.outcomes.length > 0 && (
        <p className={styles.techLine}>
          <span className={styles.techLabel}>Outcomes:</span>{" "}
          {project.outcomes.map((outcome) => `${outcome.value} ${outcome.label}`).join(" · ")}
        </p>
      )}

      <TechLine label="Technologies" items={project.technologies} />

      {(project.liveUrl || project.repositoryUrl) && (
        <p className={styles.techLine}>
          <span className={styles.techLabel}>Links:</span>{" "}
          {project.liveUrl && (
            <a href={project.liveUrl} target="_blank" rel="noopener noreferrer">
              Live
            </a>
          )}
          {project.liveUrl && project.repositoryUrl && " · "}
          {project.repositoryUrl && (
            <a href={project.repositoryUrl} target="_blank" rel="noopener noreferrer">
              Source
            </a>
          )}
        </p>
      )}
    </article>
  );
}

export default function CvPage() {
  const cv = getCvData();
  const phoneUrl = `tel:${cv.basics.phone.replace(/[^+\d]/g, "")}`;

  // Flat, so the paginator can break between any two of them.
  const blocks: CvBlock[] = [
    {
      id: "header",
      keepWithNext: true,
      node: (
        <header>
          <h1 className={styles.name}>{cv.basics.name}</h1>
          <p className={styles.headline}>Curriculum Vitae</p>
          <p className={styles.contactLine}>
            {cv.basics.location} <span className={styles.separator}>|</span>{" "}
            <a className={styles.contactLink} href={phoneUrl}>
              {cv.basics.phone}
            </a>{" "}
            <span className={styles.separator}>|</span>{" "}
            <a className={styles.contactLink} href={`mailto:${cv.basics.email}`}>
              {cv.basics.email}
            </a>
          </p>
          <p className={styles.links}>
            {cv.basics.links.map((link, index) => (
              <span key={link.url}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.label}
                </a>
                {index < cv.basics.links.length - 1 && (
                  <>
                    {" "}
                    <span className={styles.separator}>|</span>{" "}
                  </>
                )}
              </span>
            ))}
          </p>
        </header>
      ),
    },
    ...sectionBlocks("Profile", [
      { id: "profile", node: <p className={styles.paragraph}>{cv.profile}</p> },
    ]),
    ...sectionBlocks(
      "Experience",
      cv.roles.map((role) => ({ id: `role-${role.slug}`, node: <RoleEntry role={role} /> })),
    ),
    ...sectionBlocks(
      "Projects",
      cv.projects.map((project) => ({
        id: `project-${project.slug}`,
        node: <ProjectEntry project={project} />,
      })),
    ),
    ...sectionBlocks(
      "Technical Skills",
      cv.skillGroups.map((group) => ({
        id: `skills-${group.label}`,
        node: (
          <p className={styles.skillGroup}>
            <span className={styles.skillLabel}>{group.label}:</span>{" "}
            {group.skills.map((skill) => skill.name).join(", ")}
          </p>
        ),
      })),
    ),
    ...sectionBlocks("Education", [
      {
        id: "education",
        node: (
          <p className={styles.education}>
            <strong>{cv.education.degree}</strong>
            <br />
            {cv.education.institution} <span className={styles.separator}>|</span>{" "}
            {cv.education.period} <span className={styles.separator}>|</span> CGPA:{" "}
            {cv.education.cgpa}
          </p>
        ),
      },
    ]),
    ...sectionBlocks("Certifications", [
      {
        id: "certifications",
        node: (
          <ul className={styles.list}>
            {cv.certifications.map((certification) => (
              <li key={certification}>{certification}</li>
            ))}
          </ul>
        ),
      },
    ]),
    {
      id: "footer",
      node: (
        <div className={styles.footer}>
          <p className={styles.footerLine}>
            <span className={styles.footerLabel}>Languages:</span> {cv.languages.join(", ")}{" "}
            <span className={styles.separator}>|</span>{" "}
            <span className={styles.footerLabel}>Strengths:</span> {cv.strengths.join(", ")}
          </p>
        </div>
      ),
    },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.actions}>
        <div className={styles.actionCopy}>
          <BackNavigationButton className={styles.backLink}>
            ← Back to portfolio
          </BackNavigationButton>
          <p className={styles.cvNote}>
            This is the long form of the résumé — every role, the work shipped in each, and
            full project detail. For the one-page version, see the{" "}
            <Link href="/resume">résumé</Link>.
          </p>
        </div>
        <DownloadCvButton cv={cv} />
      </div>

      <PaperReveal>
        <PaperViewport className={styles.paperFrame}>
          <CvPages label={`${cv.basics.name} curriculum vitae`} blocks={blocks} />
        </PaperViewport>
      </PaperReveal>
    </main>
  );
}
