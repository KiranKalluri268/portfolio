"use client";

import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import resumeAi from "@/data/resume-ai.json";
import type { ResumeInternship } from "@/lib/content/types";
import type { ResumeProject, ResumeSkillGroup } from "@/lib/content/resume";

// Kept as an independent copy of ResumePdfDocument's styles rather than a
// shared import, deliberately: the two résumés are allowed to drift in
// content and layout without either one's PDF risking the other's build.
// See the sibling file's own comment for why wrap={false} and these exact A4
// dimensions matter.
const styles = StyleSheet.create({
  page: {
    width: 595.28,
    height: 841.89,
    paddingTop: 13,
    paddingRight: 28,
    paddingBottom: 13,
    paddingLeft: 28,
    backgroundColor: "#ffffff",
    color: "#111111",
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    lineHeight: 1.2,
  },
  content: {
    flexGrow: 1,
    justifyContent: "space-between",
  },
  name: { fontFamily: "Times-Bold", fontSize: 12, marginBottom: 1 },
  headline: { fontFamily: "Times-Bold", fontSize: 10.5, marginBottom: 0.5 },
  contact: { flexDirection: "row", flexWrap: "wrap" },
  contactLink: { color: "#111111", textDecoration: "none" },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  link: { color: "#0563c1", textDecoration: "underline" },
  section: { marginTop: 1.25 },
  sectionTitle: {
    borderTopWidth: 0.6,
    borderTopColor: "#8b8b8b",
    paddingTop: 1.25,
    marginBottom: 0.75,
    fontFamily: "Times-Bold",
    fontSize: 11,
  },
  entry: { marginTop: 0.4 },
  entryTitle: { fontFamily: "Times-Bold", fontSize: 10.5 },
  italic: { fontFamily: "Times-BoldItalic" },
  skillLine: { flexDirection: "row", flexWrap: "wrap" },
  bold: { fontFamily: "Times-Bold" },
  list: { marginTop: 0.4, marginBottom: 0.75, paddingLeft: 23 },
  listItem: { flexDirection: "row" },
  bullet: { width: 10 },
  listText: { flex: 1 },
  footer: {
    borderTopWidth: 0.6,
    borderTopColor: "#8b8b8b",
    paddingTop: 1.25,
    marginTop: 1.25,
    flexDirection: "row",
    flexWrap: "wrap",
  },
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
        <View style={styles.listItem} key={item}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.listText}>{item}</Text>
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
  const phoneUrl = `tel:${resumeAi.basics.phone.replace(/[^+\d]/g, "")}`;

  return (
    <Document
      title={`${resumeAi.basics.name} AI/ML Resume`}
      author={resumeAi.basics.name}
      subject="Applied Machine Learning Resume"
    >
      <Page size={{ width: 595.28, height: 841.89 }} style={styles.page} wrap={false}>
        <View style={styles.content}>
          <View>
          <Text style={styles.name}>{resumeAi.basics.name}</Text>
          <Text style={styles.headline}>{resumeAi.basics.headline}</Text>
          <View style={styles.contact}>
            <Text>{resumeAi.basics.location} | </Text>
            <Link src={phoneUrl} style={styles.contactLink}>{resumeAi.basics.phone}</Link>
            <Text> | </Text>
            <Link src={`mailto:${resumeAi.basics.email}`} style={styles.contactLink}>
              {resumeAi.basics.email}
            </Link>
          </View>
          <View style={styles.links}>
            {resumeAi.basics.links.map((link, index) => (
              <View key={link.url} style={{ flexDirection: "row" }}>
                <Link src={link.url} style={styles.link}>{link.label}</Link>
                {index < resumeAi.basics.links.length - 1 && <Text> |</Text>}
              </View>
            ))}
          </View>
          </View>

          <PdfSection title="Summary">
            <Text>{resumeAi.objective}</Text>
          </PdfSection>

          <PdfSection title="Core Skills">
            {skillGroups.map((skill) => (
              <View style={styles.skillLine} key={skill.category}>
                <Text style={styles.bold}>{skill.category}: </Text>
                <Text>{skill.items.join(", ")}</Text>
              </View>
            ))}
          </PdfSection>

          <PdfSection title="Internships">
            {internships.map((internship) => (
              <View style={styles.entry} key={`${internship.company}-${internship.role}`}>
                <Text style={styles.entryTitle}>
                  {internship.role} – {internship.company}{" "}
                  <Text style={styles.italic}>({internship.period})</Text>
                </Text>
                <BulletList items={internship.highlights} />
              </View>
            ))}
          </PdfSection>

          <PdfSection title="Projects">
            {projects.map((project) => (
              <View style={styles.entry} key={project.slug}>
                <Text style={styles.entryTitle}>
                  {project.name} <Text style={styles.italic}>({project.technologies})</Text>
                </Text>
                <BulletList items={project.highlights} />
              </View>
            ))}
          </PdfSection>

          <PdfSection title="Education">
            <Text>
              {resumeAi.education.degree} | {resumeAi.education.institution} | {resumeAi.education.period} |{" "}
              {/* A non-breaking space keeps "CGPA:" and its value from
                  splitting across a wrap. */}
              CGPA:{" "}{resumeAi.education.cgpa}
            </Text>
          </PdfSection>

          <View style={styles.footer}>
            <Text style={styles.bold}>Languages: </Text>
            <Text>{resumeAi.languages.join(", ")} | </Text>
            <Text style={styles.bold}>Strengths: </Text>
            <Text>{resumeAi.strengths.join(", ")}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
