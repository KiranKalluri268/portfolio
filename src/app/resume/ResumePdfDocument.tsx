"use client";

import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import resume from "@/data/resume.json";
import type { ResumeInternship } from "@/lib/content/types";
import type { ResumeProject, ResumeSkillGroup } from "@/lib/content/resume";

const styles = StyleSheet.create({
  page: {
    width: 595.28,
    height: 841.89,
    paddingTop: 25,
    paddingRight: 28,
    paddingBottom: 25,
    paddingLeft: 28,
    backgroundColor: "#ffffff",
    color: "#111111",
    fontFamily: "Helvetica",
    fontSize: 10.5,
    lineHeight: 1.27,
  },
  content: {
    flexGrow: 1,
    justifyContent: "space-between",
  },
  name: { fontFamily: "Helvetica-Bold", fontSize: 12, marginBottom: 1 },
  contact: { flexDirection: "row", flexWrap: "wrap" },
  contactLink: { color: "#111111", textDecoration: "none" },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  link: { color: "#b8380a", textDecoration: "underline" },
  section: { marginTop: 2.25 },
  sectionTitle: {
    borderTopWidth: 0.6,
    borderTopColor: "#8b8b8b",
    paddingTop: 2.25,
    marginBottom: 1.5,
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  entry: { marginTop: 0.75 },
  entryTitle: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  italic: { fontFamily: "Helvetica-BoldOblique" },
  skillLine: { flexDirection: "row", flexWrap: "wrap" },
  bold: { fontFamily: "Helvetica-Bold" },
  list: { marginTop: 0.75, marginBottom: 1.5, paddingLeft: 23 },
  listItem: { flexDirection: "row" },
  bullet: { width: 10 },
  listText: { flex: 1 },
  footer: {
    borderTopWidth: 0.6,
    borderTopColor: "#8b8b8b",
    paddingTop: 2.25,
    marginTop: 2.25,
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

export default function ResumePdfDocument({
  internships,
  projects,
  skillGroups,
}: {
  internships: ResumeInternship[];
  projects: ResumeProject[];
  skillGroups: ResumeSkillGroup[];
}) {
  const phoneUrl = `tel:${resume.basics.phone.replace(/[^+\d]/g, "")}`;

  return (
    <Document
      title={`${resume.basics.name} Resume`}
      author={resume.basics.name}
      subject="Professional Resume"
    >
      <Page size={{ width: 595.28, height: 841.89 }} style={styles.page} wrap={false}>
        <View style={styles.content}>
          <View>
          <Text style={styles.name}>{resume.basics.name}</Text>
          <View style={styles.contact}>
            <Text>{resume.basics.location} | </Text>
            <Link src={phoneUrl} style={styles.contactLink}>{resume.basics.phone}</Link>
            <Text> | </Text>
            <Link src={`mailto:${resume.basics.email}`} style={styles.contactLink}>
              {resume.basics.email}
            </Link>
          </View>
          <View style={styles.links}>
            {resume.basics.links.map((link, index) => (
              <View key={link.url} style={{ flexDirection: "row" }}>
                <Link src={link.url} style={styles.link}>{link.label}</Link>
                {index < resume.basics.links.length - 1 && <Text> |</Text>}
              </View>
            ))}
          </View>
          </View>

          <PdfSection title="Objective">
            <Text>{resume.objective}</Text>
          </PdfSection>

          <PdfSection title="Core Skills">
            {skillGroups.map((skill) => (
              <View style={styles.skillLine} key={skill.category}>
                <Text style={styles.bold}>{skill.category}: </Text>
                <Text>{skill.items.join(", ")}</Text>
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

          <PdfSection title="Education">
            <Text>
              {resume.education.degree} | {resume.education.institution} | {resume.education.period} | CGPA: {resume.education.cgpa}
            </Text>
          </PdfSection>

          <PdfSection title="Certifications">
            <BulletList items={resume.certifications} />
          </PdfSection>

          <View style={styles.footer}>
            <Text style={styles.bold}>Languages: </Text>
            <Text>{resume.languages.join(", ")} | </Text>
            <Text style={styles.bold}>Strengths: </Text>
            <Text>{resume.strengths.join(", ")}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
