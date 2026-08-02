import type { ComponentType } from "react";
import { FaJava } from "react-icons/fa";
import {
  SiAmazondynamodb,
  SiAmazonwebservices,
  SiCanva,
  SiCloudinary,
  SiCplusplus,
  SiCss3,
  SiDart,
  SiDocker,
  SiExpress,
  SiFigma,
  SiFlutter,
  SiGit,
  SiHtml5,
  SiJavascript,
  SiKeras,
  SiLangchain,
  SiLinux,
  SiMongodb,
  SiMysql,
  SiNextdotjs,
  SiNodedotjs,
  SiOpenai,
  SiPostgresql,
  SiPython,
  SiRazorpay,
  SiReact,
  SiRedis,
  SiSupabase,
  SiTableau,
  SiTailwindcss,
  SiTensorflow,
  SiTypescript,
  SiWebrtc,
} from "react-icons/si";

/** Brand marks for the skills marquee, keyed by skill slug.
 *
 * These used to live inline in the marquee until skills moved into JSON
 * content files, where a React element cannot be stored — every skill quietly
 * fell back to its initials. The mark belongs in code rather than data anyway:
 * it is a component, not content, and keeping the map here means the JSON
 * stays the single source of truth for everything a skill actually says.
 *
 * A slug missing from this map is not a mistake. Deep Learning, RAG and
 * Mobile Development are practices rather than products, so they have no logo
 * to show and keep the `iconText` initials the JSON gives them.
 */
export const SKILL_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  aws: SiAmazonwebservices,
  canva: SiCanva,
  cloudinary: SiCloudinary,
  cpp: SiCplusplus,
  css: SiCss3,
  dart: SiDart,
  docker: SiDocker,
  dynamodb: SiAmazondynamodb,
  express: SiExpress,
  figma: SiFigma,
  flutter: SiFlutter,
  git: SiGit,
  "gpt-4": SiOpenai,
  html: SiHtml5,
  java: FaJava,
  javascript: SiJavascript,
  keras: SiKeras,
  langchain: SiLangchain,
  linux: SiLinux,
  mongodb: SiMongodb,
  mysql: SiMysql,
  "next-js": SiNextdotjs,
  "node-js": SiNodedotjs,
  postgresql: SiPostgresql,
  python: SiPython,
  razorpay: SiRazorpay,
  react: SiReact,
  redis: SiRedis,
  supabase: SiSupabase,
  tableau: SiTableau,
  "tailwind-css": SiTailwindcss,
  "tensorflow-js": SiTensorflow,
  typescript: SiTypescript,
  webrtc: SiWebrtc,
};
