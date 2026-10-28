import type { ReactNode } from "react";
import type { ResumeInternship, ResumeJson } from "@/lib/content/types";
import type { ResumeProject, ResumeSkillGroup } from "@/lib/content/resume";
import { REVEAL_LEAD_IN_MS, RESUME_STEP_MS, revealProps } from "@/components/paper-reveal";
import { plainText, splitEmphasis } from "./emphasis";
import styles from "./resume.module.css";

/** Reading order, and the only place it is written down. The header is the
 *  first piece to land and Education the last; everything between is a
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

function Emphasised({ text }: { text: string }) {
  return splitEmphasis(text).map((run, index) =>
    run.bold ? <strong key={index}>{run.text}</strong> : run.text,
  );
}

function Highlights({ items }: { items: string[] }) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={plainText(item)}>
          <Emphasised text={item} />
        </li>
      ))}
    </ul>
  );
}

/** One heading row: a bold label on the left, a bold date or figure on the
 *  right, the way the printed résumé sets every entry. */
function EntryRow({ left, right, italic = false }: { left: ReactNode; right?: ReactNode; italic?: boolean }) {
  return (
    <p className={italic ? styles.entrySubRow : styles.entryRow}>
      <span>{left}</span>
      {right && <span className={styles.entryRight}>{right}</span>}
    </p>
  );
}

/** The A4 sheet both résumés share. Content differs between /resume and
 *  /resume/ai; the typesetting does not, so it lives in one place. */
export default function ResumeSheet({
  resume,
  internships,
  projects,
  skillGroups,
  label,
}: {
  resume: ResumeJson;
  internships: ResumeInternship[];
  projects: ResumeProject[];
  skillGroups: ResumeSkillGroup[];
  label: string;
}) {
  const { basics, education } = resume;
  const contacts = [
    { label: basics.phone, url: `tel:${basics.phone.replace(/[^+\d]/g, "")}` },
    { label: basics.email, url: `mailto:${basics.email}` },
    ...basics.links,
  ];

  return (
    <article className={styles.paper} aria-label={label}>
      <header className={styles.header} {...landsAt(0)}>
        <h1 className={styles.name}>{basics.name}</h1>
        <p className={styles.headline}>{basics.headline}</p>
        <p className={styles.location}>{basics.location}</p>
        <p className={styles.contactLine}>
          {contacts.map((contact, index) => (
            <span key={contact.url}>
              {index > 0 && <span className={styles.separator}> | </span>}
              <a
                href={contact.url}
                {...(contact.url.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {contact.label}
              </a>
            </span>
          ))}
        </p>
      </header>

      <Section title="Summary" order={1}>
        <p className={styles.paragraph}>{resume.objective}</p>
      </Section>

      <Section title="Experience" order={2}>
        {internships.map((internship) => (
          <div className={styles.entry} key={`${internship.company}-${internship.role}`}>
            <EntryRow
              left={
                internship.companyUrl ? (
                  <a href={internship.companyUrl} target="_blank" rel="noopener noreferrer">
                    {internship.company}
                  </a>
                ) : (
                  internship.company
                )
              }
              right={internship.period}
            />
            <EntryRow left={internship.role} italic />
            <Highlights items={internship.highlights} />
          </div>
        ))}
      </Section>

      <Section title="Projects" order={3}>
        {projects.map((project) => (
          <div className={styles.entry} key={project.slug}>
            <p className={styles.entryRow}>
              <span>
                {project.liveUrl ? (
                  <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className={styles.projectLink}>
                    {project.name}
                  </a>
                ) : (
                  project.name
                )}{" "}
                <span className={styles.technologies}>({project.technologies})</span>
              </span>
            </p>
            <Highlights items={project.highlights} />
          </div>
        ))}
      </Section>

      <Section title="Core Skills" order={4}>
        <div className={styles.skills}>
          {skillGroups.map((skill) => (
            <p className={styles.skill} key={skill.category}>
              <span className={styles.skillLabel}>{skill.category}:</span> {skill.items.join(", ")}
            </p>
          ))}
        </div>
      </Section>

      <Section title="Education" order={5}>
        <div className={styles.entry}>
          <EntryRow left={education.institution} right={education.period} />
          <EntryRow
            left={education.degree}
            right={<span className={styles.noBreak}>CGPA: {education.cgpa}</span>}
            italic
          />
        </div>
        <p className={styles.footerLine}>
          Languages: {resume.languages.join(", ")} <span className={styles.separator}>|</span> Strengths:{" "}
          {resume.strengths.join(", ")}
        </p>
      </Section>
    </article>
  );
}
