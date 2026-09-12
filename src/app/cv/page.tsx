import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import BackNavigationButton from "@/components/BackNavigationButton";
import { getCvData } from "@/lib/content/cv";
import type { CvProject, CvRole, CvSkillGroup } from "@/lib/content/types";
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

      {role.overview.map((paragraph) => (
        <p className={styles.paragraph} key={paragraph}>
          {paragraph}
        </p>
      ))}

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

      {role.outcomes.length > 0 && (
        <p className={styles.techLine}>
          <span className={styles.techLabel}>Outcomes:</span>{" "}
          {role.outcomes.map((outcome) => `${outcome.value} ${outcome.label}`).join(" · ")}
        </p>
      )}

      {role.lessonsLearned.length > 0 && (
        <>
          <h4 className={styles.subheading}>Lessons learned</h4>
          <ul className={styles.list}>
            {role.lessonsLearned.map((lesson) => (
              <li key={lesson}>{lesson}</li>
            ))}
          </ul>
        </>
      )}

      {role.recommendations.map((recommendation) => (
        <blockquote className={styles.quote} key={recommendation.author}>
          {recommendation.quote.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <p className={styles.quoteAttribution}>
            <span className={styles.quoteAuthor}>{recommendation.author}</span>
            {recommendation.authorTitle && `, ${recommendation.authorTitle}`}
          </p>
        </blockquote>
      ))}
    </article>
  );
}

function SkillGroupEntry({ group }: { group: CvSkillGroup }) {
  return (
    <article className={styles.entry}>
      <h3 className={styles.entryTitle}>{group.label}</h3>
      {group.skills.map((skill) => (
        <div className={styles.workItem} key={skill.name}>
          <p className={styles.workItemTitle}>{skill.name}</p>
          <p className={styles.workItemBody}>{skill.shortDescription}</p>
          {skill.howIUseIt.length > 0 && (
            <p className={styles.impact}>
              <strong>How I use it:</strong> {skill.howIUseIt.join(" ")}
            </p>
          )}
        </div>
      ))}
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

      {project.overview.map((paragraph) => (
        <p className={styles.paragraph} key={paragraph}>
          {paragraph}
        </p>
      ))}

      {project.problem && (
        <p className={styles.paragraph}>
          <strong>Problem:</strong> {project.problem}
        </p>
      )}
      {project.solution && (
        <p className={styles.paragraph}>
          <strong>Solution:</strong> {project.solution}
        </p>
      )}

      {project.howItWorks.length > 0 && (
        <>
          <h4 className={styles.subheading}>How it works</h4>
          {project.howItWorks.map((item) => (
            <div className={styles.workItem} key={item.title}>
              <p className={styles.workItemTitle}>{item.title}</p>
              <p className={styles.workItemBody}>{item.description}</p>
            </div>
          ))}
        </>
      )}

      {project.buildingProcess.length > 0 && (
        <>
          <h4 className={styles.subheading}>How it was built</h4>
          {project.buildingProcess.map((item) => (
            <div className={styles.workItem} key={item.title}>
              <p className={styles.workItemTitle}>{item.title}</p>
              <p className={styles.workItemBody}>{item.description}</p>
            </div>
          ))}
        </>
      )}

      {project.challenges.length > 0 && (
        <>
          <h4 className={styles.subheading}>Challenges</h4>
          {project.challenges.map((item) => (
            <div className={styles.workItem} key={item.challenge}>
              <p className={styles.workItemTitle}>{item.challenge}</p>
              <p className={styles.workItemBody}>{item.solution}</p>
              {item.lesson && (
                <p className={styles.impact}>
                  <strong>Lesson:</strong> {item.lesson}
                </p>
              )}
            </div>
          ))}
        </>
      )}

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

      {project.lessonsLearned.length > 0 && (
        <>
          <h4 className={styles.subheading}>Lessons learned</h4>
          <ul className={styles.list}>
            {project.lessonsLearned.map((lesson) => (
              <li key={lesson}>{lesson}</li>
            ))}
          </ul>
        </>
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
        node: <SkillGroupEntry group={group} />,
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
            {cv.education.period} <span className={styles.separator}>|</span>{" "}
            <span className={styles.noBreak}>CGPA: {cv.education.cgpa}</span>
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
        <div className={styles.topRow}>
          <BackNavigationButton className={styles.backLink}>
            ← Back to portfolio
          </BackNavigationButton>
          <DownloadCvButton cv={cv} />
        </div>
        <p className={styles.cvNote}>
          This is the long form of the résumé — every role, the work shipped in each, and
          full project detail. For the one-page version, see the{" "}
          <Link href="/resume">résumé</Link>.
        </p>
      </div>

      <PaperReveal>
        <PaperViewport className={styles.paperFrame}>
          <CvPages label={`${cv.basics.name} curriculum vitae`} blocks={blocks} />
        </PaperViewport>
      </PaperReveal>
    </main>
  );
}
