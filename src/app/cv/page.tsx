import type { Metadata } from "next";
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

          {role.overview.map((paragraph) => (
            <p className={styles.paragraph} key={paragraph}>
              {paragraph}
            </p>
          ))}
        </article>
      ),
    },
  ];

  if (role.workItems.length > 0) {
    blocks.push({
      id: `role-${role.slug}-work-heading`,
      keepWithNext: true,
      node: <h4 className={styles.subheading}>What I worked on</h4>,
    });
    role.workItems.forEach((item, index) => {
      blocks.push({
        id: `role-${role.slug}-work-${index}`,
        node: (
          <div className={styles.workItem}>
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
        ),
      });
    });
  }

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

  if (role.lessonsLearned.length > 0) {
    blocks.push({
      id: `role-${role.slug}-lessons`,
      node: (
        <>
          <h4 className={styles.subheading}>Lessons learned</h4>
          <ul className={styles.list}>
            {role.lessonsLearned.map((lesson) => (
              <li key={lesson}>{lesson}</li>
            ))}
          </ul>
        </>
      ),
    });
  }

  role.recommendations.forEach((recommendation, index) => {
    blocks.push({
      id: `role-${role.slug}-recommendation-${index}`,
      node: (
        <blockquote className={styles.quote}>
          {recommendation.quote.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <p className={styles.quoteAttribution}>
            <span className={styles.quoteAuthor}>{recommendation.author}</span>
            {recommendation.authorTitle && `, ${recommendation.authorTitle}`}
          </p>
        </blockquote>
      ),
    });
  });

  return blocks;
}

/** One block per skill, so a long skill group can still hand off remaining
 *  page space to whatever comes next instead of moving as one unit. */
function skillGroupBlocks(group: CvSkillGroup): CvBlock[] {
  const groupId = `skills-${group.label}`;
  return [
    {
      id: `${groupId}-heading`,
      keepWithNext: true,
      node: (
        <article className={styles.entry}>
          <h3 className={styles.entryTitle}>{group.label}</h3>
        </article>
      ),
    },
    ...group.skills.map((skill) => ({
      id: `${groupId}-${skill.name}`,
      node: (
        <div className={styles.workItem}>
          <p className={styles.workItemTitle}>{skill.name}</p>
          <p className={styles.workItemBody}>{skill.shortDescription}</p>
          {skill.howIUseIt.length > 0 && (
            <p className={styles.impact}>
              <strong>How I use it:</strong> {skill.howIUseIt.join(" ")}
            </p>
          )}
        </div>
      ),
    })),
  ];
}

/** Same reasoning as roleBlocks: one block per process step and challenge
 *  rather than one block for the whole project. */
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
        </article>
      ),
    },
  ];

  function processSteps(label: string, key: string, items: CvProject["howItWorks"]) {
    if (items.length === 0) return;
    blocks.push({
      id: `project-${project.slug}-${key}-heading`,
      keepWithNext: true,
      node: <h4 className={styles.subheading}>{label}</h4>,
    });
    items.forEach((item, index) => {
      blocks.push({
        id: `project-${project.slug}-${key}-${index}`,
        node: (
          <div className={styles.workItem}>
            <p className={styles.workItemTitle}>{item.title}</p>
            <p className={styles.workItemBody}>{item.description}</p>
          </div>
        ),
      });
    });
  }

  processSteps("How it works", "how-it-works", project.howItWorks);
  processSteps("How it was built", "building-process", project.buildingProcess);

  if (project.challenges.length > 0) {
    blocks.push({
      id: `project-${project.slug}-challenges-heading`,
      keepWithNext: true,
      node: <h4 className={styles.subheading}>Challenges</h4>,
    });
    project.challenges.forEach((item, index) => {
      blocks.push({
        id: `project-${project.slug}-challenge-${index}`,
        node: (
          <div className={styles.workItem}>
            <p className={styles.workItemTitle}>{item.challenge}</p>
            <p className={styles.workItemBody}>{item.solution}</p>
            {item.lesson && (
              <p className={styles.impact}>
                <strong>Lesson:</strong> {item.lesson}
              </p>
            )}
          </div>
        ),
      });
    });
  }

  if (project.highlights.length > 0) {
    blocks.push({
      id: `project-${project.slug}-highlights`,
      node: (
        <ul className={styles.list}>
          {project.highlights.map((highlight) => (
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

  if (project.lessonsLearned.length > 0) {
    blocks.push({
      id: `project-${project.slug}-lessons`,
      node: (
        <>
          <h4 className={styles.subheading}>Lessons learned</h4>
          <ul className={styles.list}>
            {project.lessonsLearned.map((lesson) => (
              <li key={lesson}>{lesson}</li>
            ))}
          </ul>
        </>
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
