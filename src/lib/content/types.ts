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

export interface ProjectContent {
  id: number;
  slug: string;
  title: string;
  summary: string;
  status: ContentStatus;
  featured: boolean;
  showInProjectsSection: boolean;
  projectsSectionOrder: number;
  image: string;
  imageAlt: string;
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
