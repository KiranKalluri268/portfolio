import type { Metadata } from "next";
import Link from "next/link";
import BackNavigationButton from "@/components/BackNavigationButton";
import { getCvData } from "@/lib/content/cv";
import type { CvProject, CvPublication, CvRole, CvSkillGroup } from "@/lib/content/types";
import PaperViewport from "@/components/PaperViewport";
import PaperReveal from "@/components/PaperReveal";
import CvPages, { type CvBlock } from "./CvPages";
import DownloadCvButton from "./DownloadCvButton";
import styles from "./cv.module.css";

export const metadata: Metadata = {
  title: "CV",
  description:
    "The full curriculum vitae of software engineer Saikiran Kalluri: every role, the work shipped in each, projects, and technical skills.",
  alternates: { canonical: "/cv" },
  openGraph: {
    title: "CV | Saikiran Kalluri",
    description:
      "Curriculum vitae covering experience, work shipped, projects, and skills.",
    url: "/cv",
  },
};

/** A section as flat blocks: its heading, then each of its entries' own
 *  blocks. The paginator needs to break between any two of them, which it
 *  cannot do while they are wrapped in one element. An unnamed <section> is
 *  not exposed as a landmark anyway, so the heading outline still carries
 *  the structure. */
function sectionBlocks(title: string, entryBlocks: CvBlock[][]): CvBlock[] {
  if (entryBlocks.length === 0) return [];
  return [
    {
      id: `heading-${title}`,
      keepWithNext: true,
      node: <h2 className={styles.sectionTitle}>{title}</h2>,
    },
    ...entryBlocks.flat(),
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

/** Split into one block per work item (plus its own "What I worked on"
 *  heading) rather than one block for the whole role, so a short role
 *  doesn't force everything after it onto a fresh page just because the
 *  role as a whole didn't fit what was left of the current one. */
function roleBlocks(role: CvRole): CvBlock[] {
  const blocks: CvBlock[] = [
    {
      id: `role-${role.slug}-header`,
      keepWithNext: true,
      node: (
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
        </article>
      ),
    },
  ];

  // The CV is skimmed, not read: one line per piece of work. The full
  // write-up of each lives on the role's own page.
  role.workItems.forEach((item, index) => {
    blocks.push({
      id: `role-${role.slug}-work-${index}`,
      node: (
        <ul className={styles.list}>
          <li>
            <strong>{item.title}:</strong> {item.line}
          </li>
        </ul>
      ),
    });
  });

  blocks.push({
    id: `role-${role.slug}-tech`,
    node: <TechLine label="Technologies" items={role.technologies} />,
  });

  if (role.outcomes.length > 0) {
    blocks.push({
      id: `role-${role.slug}-outcomes`,
      node: (
        <p className={styles.techLine}>
          <span className={styles.techLabel}>Outcomes:</span>{" "}
          {role.outcomes.map((outcome) => `${outcome.value} ${outcome.label}`).join(" · ")}
        </p>
      ),
    });
  }

  return blocks;
}

/** A group is one line of names, as on any CV; what each skill is and how I
 *  use it is on the skill's own page. */
function skillGroupBlocks(group: CvSkillGroup): CvBlock[] {
  return [
    {
      id: `skills-${group.label}`,
      node: (
        <p className={styles.techLine}>
          <span className={styles.techLabel}>{group.label}:</span>{" "}
          {group.skills.map((skill) => skill.name).join(", ")}
        </p>
      ),
    },
  ];
}

/** One citation: the authors as the paper prints them with mine in bold,
 *  then the title, where and when it appeared. */
function publicationBlocks(publication: CvPublication): CvBlock[] {
  return [
    {
      id: `publication-${publication.slug}`,
      node: (
        <p className={styles.paragraph}>
          {publication.authors.map((author, index) => (
            <span key={author}>
              {index > 0 && ", "}
              {author === publication.selfAuthor ? <strong>{author}</strong> : author}
            </span>
          ))}
          . “
          <a href={publication.url} target="_blank" rel="noopener noreferrer">
            {publication.title}
          </a>
          .” <em>{publication.venue}</em>
          {publication.volumeIssue && `, ${publication.volumeIssue}`}, {publication.date}.
        </p>
      ),
    },
  ];
}

/** At most this many highlights per project; the rest are on its page. */
const PROJECT_HIGHLIGHTS = 3;

function projectBlocks(project: CvProject): CvBlock[] {
  const blocks: CvBlock[] = [
    {
      id: `project-${project.slug}-header`,
      keepWithNext: true,
      node: (
        <article className={styles.entry}>
          <div className={styles.entryHeader}>
            <h3 className={styles.entryTitle}>{project.title}</h3>
            <span className={styles.entryMeta}>{project.role}</span>
          </div>

          <p className={`${styles.paragraph} ${styles.summary}`}>{project.summary}</p>
        </article>
      ),
    },
  ];

  if (project.highlights.length > 0) {
    blocks.push({
      id: `project-${project.slug}-highlights`,
      node: (
        <ul className={styles.list}>
          {project.highlights.slice(0, PROJECT_HIGHLIGHTS).map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      ),
    });
  }

  if (project.outcomes.length > 0) {
    blocks.push({
      id: `project-${project.slug}-outcomes`,
      node: (
        <p className={styles.techLine}>
          <span className={styles.techLabel}>Outcomes:</span>{" "}
          {project.outcomes.map((outcome) => `${outcome.value} ${outcome.label}`).join(" · ")}
        </p>
      ),
    });
  }

  blocks.push({
    id: `project-${project.slug}-tech`,
    node: (
      <>
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
      </>
    ),
  });

  return blocks;
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
      [{ id: "profile", node: <p className={styles.paragraph}>{cv.profile}</p> }],
    ]),
    ...sectionBlocks("Experience", cv.roles.map(roleBlocks)),
    ...sectionBlocks("Projects", cv.projects.map(projectBlocks)),
    ...sectionBlocks("Publications", cv.publications.map(publicationBlocks)),
    ...sectionBlocks("Technical Skills", cv.skillGroups.map(skillGroupBlocks)),
    ...sectionBlocks("Education", [
      [
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
      ],
    ]),
    ...sectionBlocks("Certifications", [
      [
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
      ],
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
          This is my full CV — every role and project, one line each. The detail behind
          each one is on its own page. For the one-page version, see my{" "}
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
