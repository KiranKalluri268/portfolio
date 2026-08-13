export type ContentStatus = "draft" | "published";

export interface ContentSeo {
  title: string;
  description: string;
}

export interface ProjectOutcome {
  value: string;
  label: string;
}

export interface ProjectProcessItem {
  title: string;
  description: string;
}

export interface ProjectChallenge {
  challenge: string;
  solution: string;
  lesson?: string;
}

export interface ProjectGalleryItem {
  src: string;
  alt: string;
  caption?: string;
}

/** Résumé-specific presentation for a project. The résumé is a one-page brief,
 *  so it often needs tighter wording than the case study carries. */
export interface ProjectResumeEntry {
  technologies: string;
  highlights: string[];
  order?: number;
}

export interface ProjectContent {
  id: number;
  slug: string;
  title: string;
  summary: string;
  status: ContentStatus;
  featured: boolean;
  showInProjectsSection: boolean;
  projectsSectionOrder: number;
  /** Opt in to the one-page résumé. The CV always includes everything. */
  showInResume: boolean;
  resume?: ProjectResumeEntry;
  /** Optional: internal and client work often has no shareable screenshot, in
   *  which case the UI falls back to a generated monogram panel. */
  image?: string;
  imageAlt?: string;
  role: string;
  year?: number;
  repositoryUrl?: string;
  liveUrl?: string;
  skills: string[];
  overview: string[];
  problem?: string;
  solution?: string;
  howItWorks: ProjectProcessItem[];
  buildingProcess: ProjectProcessItem[];
  challenges: ProjectChallenge[];
  features: string[];
  highlights: string[];
  outcomes: ProjectOutcome[];
  lessonsLearned: string[];
  gallery: ProjectGalleryItem[];
  seo: ContentSeo;
}

export interface ExperiencePeriod {
  startLabel: string;
  startDate: string;
  endLabel: string;
  endDate?: string;
}

/** A single thing built or shipped during a role: a feature, an integration,
 *  a piece of infrastructure. Rendered as one entry in the nested work
 *  timeline on the experience detail page. */
export interface ExperienceWorkItem {
  title: string;
  description: string;
  kind?: "feature" | "integration" | "research" | "infrastructure" | "improvement";
  periodLabel?: string;
  impact?: string;
  /** Skill slugs, resolved to real skill pages through the content graph. */
  skills: string[];
  /** Optional slug of a project case study this work item belongs to. */
  projectSlug?: string;
}

/** A recommendation written by someone who managed the role. Quoted verbatim;
 *  `quote` holds one entry per paragraph. */
export interface ExperienceRecommendation {
  quote: string[];
  author: string;
  authorTitle: string;
  /** e.g. "Managed Saikiran directly" */
  relationship?: string;
  dateLabel?: string;
  /** Machine-readable form of dateLabel, e.g. "2026-06-11". */
  date?: string;
  /** Where the recommendation can be read in its original context. */
  sourceUrl?: string;
  sourceLabel?: string;
}

export interface ExperienceContent {
  slug: string;
  role: string;
  company: string;
  companyUrl?: string;
  status: ContentStatus;
  showInTimeline: boolean;
  /** Controls whether the role appears in the résumé and its PDF, which is an
   *  editorial choice independent of the homepage timeline. */
  showInResume: boolean;
  timelineOrder: number;
  employmentType?: string;
  period: ExperiencePeriod;
  /** Compact "Jan 2026 – Present" form used by the résumé and its PDF. */
  resumePeriod: string;
  location?: string;
  workMode?: "On-site" | "Hybrid" | "Remote";
  summary: string;
  /** Bullets shown on the homepage timeline card and in the résumé. */
  highlights: string[];
  overview: string[];
  workItems: ExperienceWorkItem[];
  skills: string[];
  outcomes: ProjectOutcome[];
  lessonsLearned: string[];
  recommendations: ExperienceRecommendation[];
  seo: ContentSeo;
}

/** Serializable projection of a role for the résumé page and its PDF renderer,
 *  which are client components and cannot import the server-only loader. */
export interface ResumeInternship {
  role: string;
  company: string;
  period: string;
  highlights: string[];
}

/* ── CV ────────────────────────────────────────────────────────────────────
 * The /cv route is the long form of /resume: every role, project, and skill
 * in the portfolio, flattened into one serializable structure so the HTML
 * page and the client-side PDF renderer read from exactly the same data.
 */

export interface CvWorkItem {
  title: string;
  description: string;
  kind?: string;
  impact?: string;
  technologies: string[];
  projectTitle?: string;
}

export interface CvRole {
  slug: string;
  role: string;
  company: string;
  employmentType?: string;
  period: string;
  location?: string;
  workMode?: string;
  summary: string;
  workItems: CvWorkItem[];
  technologies: string[];
}

export interface CvProject {
  slug: string;
  title: string;
  role: string;
  summary: string;
  highlights: string[];
  outcomes: ProjectOutcome[];
  technologies: string[];
  repositoryUrl?: string;
  liveUrl?: string;
}

export interface CvSkillGroup {
  label: string;
  skills: Array<{ name: string; shortDescription: string }>;
}

export interface CvData {
  basics: {
    name: string;
    location: string;
    phone: string;
    email: string;
    links: Array<{ label: string; url: string }>;
  };
  profile: string;
  roles: CvRole[];
  projects: CvProject[];
  skillGroups: CvSkillGroup[];
  education: {
    degree: string;
    institution: string;
    period: string;
    cgpa: string;
  };
  certifications: string[];
  languages: string[];
  strengths: string[];
}

export interface SkillCategoryContent {
  slug: string;
  label: string;
  order: number;
  marqueeDirection: "left" | "right";
}

export interface SkillResource {
  label: string;
  url: string;
}

export interface SkillContent {
  slug: string;
  name: string;
  shortDescription: string;
  status: ContentStatus;
  category: string;
  webCategory: string;
  proficiency?: "learning" | "comfortable" | "advanced";
  icon?: string;
  iconAlt?: string;
  iconText?: string;
  showInSkillsSection: boolean;
  skillsSectionOrder: number;
  /** Opt in to the one-page résumé. The CV always includes everything. */
  showInResume: boolean;
  /** Résumé grouping and wording, which is editorial and does not have to match
   *  the skill graph's categories — e.g. "Languages", or the fuller
   *  "AWS (EC2, S3, Lambda, …)" label the résumé uses. */
  resumeGroup?: string;
  resumeLabel?: string;
  resumeOrder?: number;
  whatItIs: string[];
  howILearned: string[];
  howIUseIt: string[];
  concepts: string[];
  lessonsLearned: string[];
  resources: SkillResource[];
  seo: ContentSeo;
}

export interface SkillWebCategoryContent {
  slug: string;
  label: string;
  description: string;
}

export interface SkillWebDomainContent {
  slug: string;
  label: string;
  description: string;
  accent: string;
  angle: number;
  categories: SkillWebCategoryContent[];
}

export interface SkillWebConfig {
  center: {
    label: string;
    eyebrow: string;
  };
  domains: SkillWebDomainContent[];
}

export interface SkillWebCategory extends SkillWebCategoryContent {
  skills: SkillContent[];
}

export interface SkillWebDomain extends Omit<SkillWebDomainContent, "categories"> {
  categories: SkillWebCategory[];
}

export interface SkillWebData {
  center: SkillWebConfig["center"];
  domains: SkillWebDomain[];
}

export interface ResumeLink {
  label: string;
  url: string;
}

export interface ResumeBasics {
  name: string;
  headline: string;
  location: string;
  phone: string;
  email: string;
  links: ResumeLink[];
}

export interface ResumeEducation {
  degree: string;
  institution: string;
  period: string;
  cgpa: string;
}

/** The shape of resume.json itself, read as plain typed JSON everywhere else
 *  in the app - this is only used to give validateResumeJson (in resume.ts)
 *  something to assert against and return. */
export interface ResumeJson {
  basics: ResumeBasics;
  objective: string;
  skillGroupOrder: string[];
  education: ResumeEducation;
  certifications: string[];
  languages: string[];
  strengths: string[];
}

export interface AboutSegment {
  text: string;
  accent: boolean;
}

/** The shape of about.json - see the ResumeJson comment above, same reason. */
export interface AboutJson {
  eyebrow: string;
  ariaLabel: string;
  segments: AboutSegment[];
}
