"use client";

import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { CvData, CvProject, CvRole } from "@/lib/content/types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 38,
    paddingRight: 40,
    paddingBottom: 46,
    paddingLeft: 40,
    backgroundColor: "#ffffff",
    color: "#111111",
    fontFamily: "Helvetica",
    fontSize: 9.5,
    // No lineHeight here on purpose. Setting it on the Page stops `fixed`
    // absolutely-positioned children — the page-number footer — from
    // rendering at all, and react-pdf's default leading is what we want.
  },
  name: { fontFamily: "Helvetica-Bold", fontSize: 18, marginBottom: 2 },
  headline: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: "#444444", marginBottom: 5 },
  contact: { flexDirection: "row", flexWrap: "wrap" },
  contactLink: { color: "#111111", textDecoration: "none" },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 },
  link: { color: "#b8380a", textDecoration: "underline" },

  section: { marginTop: 13 },
  sectionTitle: {
    borderBottomWidth: 1.2,
    borderBottomColor: "#333333",
    paddingBottom: 2.5,
    marginBottom: 5,
    fontFamily: "Helvetica-Bold",
    fontSize: 11.5,
    letterSpacing: 0.5,
  },

  entry: { marginTop: 9 },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  entryTitle: { fontFamily: "Helvetica-Bold", fontSize: 10.5, flex: 1, paddingRight: 8 },
  entryMeta: { fontFamily: "Helvetica-Oblique", fontSize: 8.5, color: "#444444" },
  entrySubtitle: { fontFamily: "Helvetica-Bold", fontSize: 9.5, color: "#333333", marginTop: 1 },
  paragraph: { marginTop: 4 },

  subheading: {
    marginTop: 7,
    marginBottom: 2,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 0.4,
    color: "#333333",
  },

  workItem: {
    marginTop: 6,
    borderLeftWidth: 1.5,
    borderLeftColor: "#d4d4d4",
    paddingLeft: 8,
  },
  workItemHeader: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  workItemTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  kind: {
    marginLeft: 5,
    color: "#555555",
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    letterSpacing: 0.5,
  },
  meta: { marginTop: 2, fontSize: 8.5, color: "#444444" },
  metaLabel: { fontFamily: "Helvetica-Bold" },

  list: { marginTop: 3, paddingLeft: 4 },
  listItem: { flexDirection: "row", marginBottom: 1.5 },
  bullet: { width: 9 },
  listText: { flex: 1 },

  quote: {
    marginTop: 7,
    borderLeftWidth: 2,
    borderLeftColor: "#999999",
    paddingLeft: 9,
    paddingTop: 1,
    paddingBottom: 1,
  },
  quoteText: { fontFamily: "Helvetica-Oblique" },
  quoteAttribution: { marginTop: 3, fontSize: 8.5, color: "#333333" },
  bold: { fontFamily: "Helvetica-Bold" },

  skillLine: { flexDirection: "row", flexWrap: "wrap", marginTop: 3 },
  footer: {
    marginTop: 13,
    borderTopWidth: 0.8,
    borderTopColor: "#999999",
    paddingTop: 4,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  pageNumber: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: "center",
    color: "#888888",
    fontSize: 8,
  },
});

function PdfSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      {/* The heading must not be the last thing on a page. */}
      <Text style={styles.sectionTitle} minPresenceAhead={40}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View style={styles.listItem} key={item} wrap={false}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <Text style={styles.meta}>
      <Text style={styles.metaLabel}>{label}: </Text>
      {value}
    </Text>
  );
}

function RoleEntry({ role }: { role: CvRole }) {
  const subtitle = [role.company, role.employmentType, role.location]
    .filter(Boolean)
    .join("  |  ");

  return (
    <View style={styles.entry}>
      <View style={styles.entryHeader} wrap={false}>
        <Text style={styles.entryTitle}>{role.role}</Text>
        <Text style={styles.entryMeta}>{role.period}</Text>
      </View>
      <Text style={styles.entrySubtitle}>{subtitle}</Text>

      <Text style={styles.paragraph}>{role.summary}</Text>

      {role.workItems.length > 0 && (
        <>
          <Text style={styles.subheading}>WHAT I WORKED ON</Text>
          {role.workItems.map((item) => (
            <View style={styles.workItem} key={item.title}>
              <View style={styles.workItemHeader}>
                <Text style={styles.workItemTitle}>{item.title}</Text>
                {item.kind && <Text style={styles.kind}>{item.kind.toUpperCase()}</Text>}
              </View>
              <Text style={styles.paragraph}>{item.description}</Text>
              {item.impact && <MetaLine label="Impact" value={item.impact} />}
              {item.projectTitle && <MetaLine label="Project" value={item.projectTitle} />}
              <MetaLine label="Technologies" value={item.technologies.join(" · ")} />
            </View>
          ))}
        </>
      )}

    </View>
  );
}

function ProjectEntry({ project }: { project: CvProject }) {
  const links = [
    project.liveUrl ? `Live: ${project.liveUrl}` : "",
    project.repositoryUrl ? `Source: ${project.repositoryUrl}` : "",
  ]
    .filter(Boolean)
    .join("   ");

  return (
    <View style={styles.entry}>
      <View style={styles.entryHeader} wrap={false}>
        <Text style={styles.entryTitle}>{project.title}</Text>
        <Text style={styles.entryMeta}>{project.role}</Text>
      </View>

      <Text style={styles.paragraph}>{project.summary}</Text>
      <BulletList items={project.highlights} />

      {project.outcomes.length > 0 && (
        <MetaLine
          label="Outcomes"
          value={project.outcomes.map((o) => `${o.value} ${o.label}`).join(" · ")}
        />
      )}
      <MetaLine label="Technologies" value={project.technologies.join(" · ")} />
      {links && <MetaLine label="Links" value={links} />}
    </View>
  );
}

export default function CvPdfDocument({ cv }: { cv: CvData }) {
  const phoneUrl = `tel:${cv.basics.phone.replace(/[^+\d]/g, "")}`;

  return (
    <Document
      title={`${cv.basics.name} CV`}
      author={cv.basics.name}
      subject="Curriculum Vitae"
    >
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.name}>{cv.basics.name}</Text>
          <Text style={styles.headline}>Curriculum Vitae</Text>
          <View style={styles.contact}>
            <Text>{cv.basics.location} | </Text>
            <Link src={phoneUrl} style={styles.contactLink}>
              {cv.basics.phone}
            </Link>
            <Text> | </Text>
            <Link src={`mailto:${cv.basics.email}`} style={styles.contactLink}>
              {cv.basics.email}
            </Link>
          </View>
          <View style={styles.links}>
            {cv.basics.links.map((link, index) => (
              <View key={link.url} style={{ flexDirection: "row" }}>
                <Link src={link.url} style={styles.link}>
                  {link.label}
                </Link>
                {index < cv.basics.links.length - 1 && <Text> |</Text>}
              </View>
            ))}
          </View>
        </View>

        <PdfSection title="PROFILE">
          <Text>{cv.profile}</Text>
        </PdfSection>

        <PdfSection title="EXPERIENCE">
          {cv.roles.map((role) => (
            <RoleEntry key={role.slug} role={role} />
          ))}
        </PdfSection>

        <PdfSection title="PROJECTS">
          {cv.projects.map((project) => (
            <ProjectEntry key={project.slug} project={project} />
          ))}
        </PdfSection>

        <PdfSection title="TECHNICAL SKILLS">
          {cv.skillGroups.map((group) => (
            <View style={styles.skillLine} key={group.label}>
              <Text style={styles.bold}>{group.label}: </Text>
              <Text>{group.skills.map((skill) => skill.name).join(", ")}</Text>
            </View>
          ))}
        </PdfSection>

        <PdfSection title="EDUCATION">
          <Text style={styles.bold}>{cv.education.degree}</Text>
          <Text>
            {cv.education.institution} | {cv.education.period} | CGPA:{" "}
            {cv.education.cgpa}
          </Text>
        </PdfSection>

        <PdfSection title="CERTIFICATIONS">
          <BulletList items={cv.certifications} />
        </PdfSection>

        <View style={styles.footer}>
          <Text style={styles.bold}>Languages: </Text>
          <Text>{cv.languages.join(", ")} | </Text>
          <Text style={styles.bold}>Strengths: </Text>
          <Text>{cv.strengths.join(", ")}</Text>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
