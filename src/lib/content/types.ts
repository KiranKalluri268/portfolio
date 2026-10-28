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

/** Numbered keys define display order. Null entries reserve a future slot. */
export type ProjectGallery = Record<string, string | ProjectGalleryItem | null>;

/** Résumé-specific presentation for a project. The résumé is a one-page brief,
 *  so it often needs tighter wording than the case study carries. */
export interface ProjectResumeEntry {
  /** The résumé's own heading for the project, when it differs from the case
   *  study title. Falls back to the project title. */
  title?: string;
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
  /** Opt in to the AI/ML-focused résumé variant at /resume/ai, independent of
   *  showInResume/resume — a project can appear on one résumé, the other,
   *  both, or neither. */
  showInResumeAi?: boolean;
  resumeAi?: ProjectResumeEntry;
  /** Null is an explicit screenshot placeholder; absent or null uses the
   *  generated monogram panel until a shareable image is available. */
  image?: string | null;
  imageAlt?: string;
  role: string;
  year?: number;
  repositoryUrl?: string | null;
  landingPageUrl?: string | null;
  appUrl?: string | null;
  liveUrl?: string | null;
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
  gallery: ProjectGallery;
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
  /** One sentence standing in for the description on the CV, where a
   *  paragraph per item is more than a reader will get through. */
  cvLine?: string;
  /** False leaves the item off the CV, e.g. when it only repeats the role's
   *  summary. Defaults to shown. */
  showOnCv?: boolean;
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
  /** Bullets shown on the homepage timeline card, and in the résumé unless
   *  `resume` gives it its own. */
  highlights: string[];
  /** Résumé-specific wording, for when the one-page résumé needs a different
   *  title or tighter bullets than the timeline card carries. */
  resume?: ExperienceResumeEntry;
  overview: string[];
  workItems: ExperienceWorkItem[];
  skills: string[];
  outcomes: ProjectOutcome[];
  lessonsLearned: string[];
  recommendations: ExperienceRecommendation[];
  seo: ContentSeo;
}

export interface ExperienceResumeEntry {
  role?: string;
  highlights: string[];
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
  /** What the CV prints: the item's cvLine, or its description if it has none. */
  line: string;
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
  overview: string[];
  workItems: CvWorkItem[];
  technologies: string[];
  outcomes: ProjectOutcome[];
  lessonsLearned: string[];
  recommendations: ExperienceRecommendation[];
}

export interface CvProject {
  slug: string;
  title: string;
  role: string;
  summary: string;
  overview: string[];
  problem?: string;
  solution?: string;
  howItWorks: ProjectProcessItem[];
  buildingProcess: ProjectProcessItem[];
  challenges: ProjectChallenge[];
  highlights: string[];
  outcomes: ProjectOutcome[];
  lessonsLearned: string[];
  technologies: string[];
  repositoryUrl?: string;
  liveUrl?: string;
}

export interface CvSkill {
  name: string;
  shortDescription: string;
  whatItIs: string[];
  howILearned: string[];
  howIUseIt: string[];
  concepts: string[];
  lessonsLearned: string[];
  resources: SkillResource[];
}

export interface CvSkillGroup {
  label: string;
  skills: CvSkill[];
}

/** One résumé variant's own curation on top of the CV data — its basics,
 *  objective, and editorial choices, carried as-is so a résumé-tailoring tool
 *  can tell the lanes apart without re-deriving them. A new resume-*.json
 *  file only needs an entry in RESUME_LANES (cv.ts) to show up here. */
export interface CvResumeLane {
  id: string;
  label: string;
  source: string;
  basics: ResumeBasics;
  objective: string;
  education: ResumeEducation;
  skillGroupOrder: string[];
  certifications: string[];
  languages: string[];
  strengths: string[];
}

/** A published paper. Authors are listed in the order the paper prints
 *  them; selfAuthor is the one of them to set in bold. */
export interface PublicationContent {
  slug: string;
  title: string;
  authors: string[];
  selfAuthor: string;
  venue: string;
  venueShort?: string;
  volume?: string;
  issue?: string;
  date: string;
  issn?: string;
  paperId?: string;
  url: string;
  /** Slug of the project the paper is the research behind. */
  relatedProject?: string;
}

export interface CvPublication {
  slug: string;
  title: string;
  authors: string[];
  selfAuthor: string;
  venue: string;
  /** "Vol. 4, Issue 4", or empty when the paper has neither. */
  volumeIssue: string;
  date: string;
  url: string;
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
  publications: CvPublication[];
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
  resumeLanes: CvResumeLane[];
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
  /** Opt in to the AI/ML-focused résumé variant at /resume/ai, with its own
   *  grouping and ordering independent of resumeGroup/resumeLabel/resumeOrder
   *  so the two résumés can each curate the same skill graph differently. */
  showInResumeAi?: boolean;
  resumeAiGroup?: string;
  resumeAiLabel?: string;
  resumeAiOrder?: number;
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
  /** Résumé skill lines that are not skills in their own right (a practice
   *  such as CI/CD), so they have no skill file and no skill page. */
  skillExtras?: ResumeSkillExtra[];
  education: ResumeEducation;
  certifications: string[];
  languages: string[];
  strengths: string[];
}

export interface ResumeSkillExtra {
  group: string;
  label: string;
  order: number;
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
