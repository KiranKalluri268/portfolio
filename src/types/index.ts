// Shared TypeScript types for the portfolio application

// Scene types
export type SceneIndex = 0 | 1 | 2 | 3 | 4 | 5;

// Experience types
export interface Experience {
  title: string;
  company: string;
  date: string;
  description: string;
}

// Form types
export interface ContactForm {
  name: string;
  email: string;
  message: string;
}

export interface FormErrors {
  [key: string]: string;
}

// Social link types
export interface SocialLink {
  name: string;
  url: string;
  svg: React.ReactNode;
}


