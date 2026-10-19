"use client";

import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import resume from "@/data/resume-ai.json";
import type { ResumeInternship } from "@/lib/content/types";
import type { ResumeProject, ResumeSkillGroup } from "@/lib/content/resume";
import { plainText } from "../emphasis";
import { PdfEmphasised, RESUME_PDF_FONT } from "../pdf-shared";

// Kept as an independent copy of ResumePdfDocument's styles rather than a
// shared import, deliberately: the two résumés are allowed to drift in
// content and layout without either one's PDF risking the other's build.
// Only the font registration and the bold-figure helper are shared.
// See the sibling file's own comment for why these exact A4 dimensions and
// `wrap` left on (not `wrap={false}`) matter. Every style with a lineHeight
// also sets its fontSize - see the sibling file for why.
const styles = StyleSheet.create({
  page: {
    width: 595.28,
    height: 841.89,
    paddingTop: 22.7,
    paddingRight: 34,
    paddingBottom: 22.7,
    paddingLeft: 34,
    backgroundColor: "#ffffff",
    color: "#000000",
    fontFamily: RESUME_PDF_FONT,
    fontSize: 10.5,
  },
  header: { alignItems: "center" },
  name: { fontSize: 24, letterSpacing: 0.5, lineHeight: 1.1 },
  small: { fontSize: 8.5, lineHeight: 1.3 },
  headline: { fontSize: 8.5, lineHeight: 1.3, fontStyle: "italic" },
  contact: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 1 },
  link: { color: "#000000", textDecoration: "underline" },
  section: { marginTop: 7 },
  sectionTitle: {
    borderBottomWidth: 0.6,
    borderBottomColor: "#000000",
    paddingBottom: 0.5,
    marginBottom: 3,
    fontSize: 12.5,
    fontWeight: 700,
  },
  paragraph: { fontSize: 10.5, lineHeight: 1.22 },
  entry: { marginBottom: 2.5 },
  row: { flexDirection: "row", justifyContent: "space-between", fontSize: 10.5, fontWeight: 700, lineHeight: 1.22 },
  subRow: { flexDirection: "row", justifyContent: "space-between", fontSize: 9.75, fontStyle: "italic", lineHeight: 1.22 },
  projectLink: { color: "#000000", textDecoration: "none" },
  technologies: { fontSize: 9.75, fontStyle: "italic", fontWeight: 400 },
  list: { marginTop: 1, paddingLeft: 12, fontSize: 9.75, lineHeight: 1.22 },
  listItem: { flexDirection: "row" },
  bullet: { width: 10 },
  skills: { paddingLeft: 7, fontSize: 9.75, lineHeight: 1.22 },
  bold: { fontWeight: 700 },
  footer: { fontSize: 9.75, lineHeight: 1.22, marginTop: 1 },
});

function PdfSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View style={styles.listItem} key={plainText(item)}>
          <Text style={styles.bullet}>•</Text>
          <PdfEmphasised text={item} />
        </View>
      ))}
    </View>
  );
}

export default function ResumeAiPdfDocument({
  internships,
  projects,
  skillGroups,
}: {
  internships: ResumeInternship[];
  projects: ResumeProject[];
  skillGroups: ResumeSkillGroup[];
}) {
  const { basics, education } = resume;
  const contacts = [
    { label: basics.phone, url: `tel:${basics.phone.replace(/[^+\d]/g, "")}` },
    { label: basics.email, url: `mailto:${basics.email}` },
    ...basics.links,
  ];

  return (
    <Document
      title={`${basics.name} AI/ML Resume`}
      author={basics.name}
      subject="Applied Machine Learning Resume"
    >
      <Page size={{ width: 595.28, height: 841.89 }} style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>{basics.name}</Text>
          <Text style={styles.headline}>{basics.headline}</Text>
          <Text style={styles.small}>{basics.location}</Text>
          <View style={[styles.small, styles.contact]}>
            {contacts.map((contact, index) => (
              <View key={contact.url} style={{ flexDirection: "row" }}>
                {/* Leading spaces are trimmed from a Text, so the first is non-breaking. */}
                {index > 0 && <Text>{" | "}</Text>}
                <Link src={contact.url} style={styles.link}>{contact.label}</Link>
              </View>
            ))}
          </View>
        </View>

        <PdfSection title="Summary">
          <Text style={styles.paragraph}>{resume.objective}</Text>
        </PdfSection>

        <PdfSection title="Experience">
          {internships.map((internship) => (
            <View style={styles.entry} key={`${internship.company}-${internship.role}`}>
              <View style={styles.row}>
                <Text>{internship.company}</Text>
                <Text>{internship.period}</Text>
              </View>
              <View style={styles.subRow}>
                <Text>{internship.role}</Text>
              </View>
              <BulletList items={internship.highlights} />
            </View>
          ))}
        </PdfSection>

        <PdfSection title="Projects">
          {projects.map((project) => (
            <View style={styles.entry} key={project.slug}>
              <Text style={styles.row}>
                {project.liveUrl ? (
                  <Link src={project.liveUrl} style={styles.projectLink}>{project.name}</Link>
                ) : (
                  project.name
                )}{" "}
                <Text style={styles.technologies}>({project.technologies})</Text>
              </Text>
              <BulletList items={project.highlights} />
            </View>
          ))}
        </PdfSection>

        <PdfSection title="Core Skills">
          <View style={styles.skills}>
            {skillGroups.map((skill) => (
              <Text key={skill.category}>
                <Text style={styles.bold}>{skill.category}: </Text>
                {skill.items.join(", ")}
              </Text>
            ))}
          </View>
        </PdfSection>

        <PdfSection title="Education">
          <View style={styles.row}>
            <Text>{education.institution}</Text>
            <Text>{education.period}</Text>
          </View>
          <View style={styles.subRow}>
            <Text>{education.degree}</Text>
            {/* A non-breaking space keeps "CGPA:" and its value together. */}
            <Text>CGPA:{" "}{education.cgpa}</Text>
          </View>
          <Text style={styles.footer}>
            Languages: {resume.languages.join(", ")} | Strengths: {resume.strengths.join(", ")}
          </Text>
        </PdfSection>
      </Page>
    </Document>
  );
}
