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
