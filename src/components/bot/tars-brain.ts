/**
 * What TARS knows, and how it answers.
 *
 * Plain functions over plain data, kept free of React so every answer can be
 * read and tested on its own. TARS never composes a claim: each answer is a
 * template filled from the content files (projects, roles, skills, résumé,
 * FAQ), and anything those do not cover gets an honest "not on file" and an
 * offer to pass the question on. So nothing can reach a visitor that is not
 * already on the site.
 *
 * TARS speaks about Saikiran, never as him. The FAQ answers are his own words,
 * and are quoted as such rather than retold.
 */

export interface BotLink {
  label: string;
  href: string;
}

export interface BotKnowledge {
  /** First name, as TARS refers to him. */
  name: string;
  /** The résumé's headline, e.g. "Full-Stack Software Engineer — …". */
  headline: string;
  location: string;
  /** The hero's line, e.g. "Hyderabad, India · Open to full-time roles · …". */
  availability: string;
  email: string;
  profiles: BotLink[];
  education: { degree: string; institution: string; period: string; cgpa: string };
  faq: Array<{ id: string; question: string; answer: string }>;
  projects: Array<{ slug: string; title: string; summary: string; skills: string[]; featured: boolean }>;
  roles: Array<{ slug: string; role: string; company: string; period: string; summary: string }>;
  skills: Array<{ slug: string; name: string; category: string; projects: string[] }>;
  /** The skill web's domains and their categories ("Machine Learning",
   *  "DevOps"), each with the skills in it. */
  areas: Array<{ label: string; skills: string[] }>;
}

export interface BotReply {
  text: string;
  /** A quoted passage shown under the text — the FAQ answers, in his words. */
  quote?: string;
  links?: BotLink[];
  /** TARS could not answer, so the chat offers to pass the question on. */
  unknown?: boolean;
}

// ---------------------------------------------------------------------------
// Reading a question

const STOPWORDS = new Set(
  ("a an the and or but if of to in on at for from by with about as is are was were be been being do does did " +
    "have has had i me my you your he him his she her they them their it its this that these those what which who " +
    "whom how why when where can could would should will shall may might must there here any some all just so " +
    "than then too very also into out up down over again please tell know like want get got saikiran saikirans " +
    "kalluri kiran").split(" "),
);

/** Lower case, accents and punctuation gone, but the characters that are part
 *  of a technology's name kept: c++, c#, node.js. */
export function normalise(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[–—]/g, " ")
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .replace(/\.(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A rough stem, so "projects", "building" and "worked" meet "project",
 *  "build" and "work". */
function stem(word: string) {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export function keywords(text: string) {
  return normalise(text)
    .split(" ")
    .filter((word) => word && !STOPWORDS.has(word))
    .map(stem);
}

/** Whether `phrase` appears in `text` as whole words. */
function mentions(text: string, phrase: string) {
  if (!phrase) return false;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}(?=\\s|$)`).test(text);
}

/** Every way a name might be typed: "Next.js" as "next.js", "nextjs",
 *  "next js"; "CertiSafe – Certificate …" by its short name too. */
function spellings(name: string) {
  const short = name.split(/\s[–—-]\s/)[0];
  // "ThirdEyeAI" typed as "third eye ai".
  const spaced = short.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  const forms = new Set<string>();
  for (const form of [name, short, spaced]) {
    const n = normalise(form);
    forms.add(n);
    forms.add(n.replace(/\./g, ""));
    forms.add(n.replace(/\./g, " "));
  }
  return [...forms].filter((form) => form.length >= 2);
}

function anyOf(text: string, words: string[]) {
  return words.some((word) => mentions(text, word));
}

// ---------------------------------------------------------------------------
// Answers

const list = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

const shortTitle = (title: string) => title.split(/\s[–—-]\s/)[0];

function projectReply(k: BotKnowledge, project: BotKnowledge["projects"][number]): BotReply {
  const built = project.skills.length ? ` Built with ${list(project.skills.slice(0, 5))}.` : "";
  return {
    text: `${project.title}: ${project.summary}${built}`,
    links: [{ label: "Read the case study", href: `/projects/${project.slug}` }],
  };
}

function rolesReply(roles: BotKnowledge["roles"]): BotReply {
  if (roles.length === 1) {
    const [role] = roles;
    return {
      // The summary is his own writing, often in the first person, so it is
      // quoted rather than retold.
      text: `${role.role} at ${role.company} (${role.period}).`,
      quote: role.summary,
      links: [{ label: "See the role", href: `/experience/${role.slug}` }],
    };
  }
  return {
    text: roles.map((role) => `${role.role} at ${role.company} (${role.period}).`).join(" "),
    links: roles.map((role) => ({ label: `${role.role} · ${role.company}`, href: `/experience/${role.slug}` })),
  };
}

function skillsReply(k: BotKnowledge, skills: BotKnowledge["skills"]): BotReply {
  const lines = skills.slice(0, 3).map((skill) =>
    skill.projects.length
      ? `${skill.name} is in ${k.name}'s stack, used in ${list(skill.projects.slice(0, 3).map(shortTitle))}.`
      : `${skill.name} is in ${k.name}'s stack.`,
  );
  return {
    text: lines.join(" "),
    links: skills.slice(0, 3).map((skill) => ({ label: `How ${k.name} uses ${skill.name}`, href: `/skills/${skill.slug}` })),
  };
}

function faqReply(k: BotKnowledge, entry: BotKnowledge["faq"][number]): BotReply {
  return {
    text: `${k.name} has answered that one. In ${k.name}'s words:`,
    quote: entry.answer,
    links: [{ label: "More questions like this", href: "/faq" }],
  };
}

/** The FAQ entry whose question is the only one to contain a rare word the
 *  visitor used: "leetcode", "student". Too weak to beat a clear intent, so
 *  it is only tried once nothing else has matched. */
function rareWordMatch(question: string[], faq: BotKnowledge["faq"]) {
  const entries = faq.map((entry) => ({ entry, words: new Set(keywords(entry.question)) }));
  for (const word of question) {
    if (word.length < 5) continue;
    const holders = entries.filter(({ words }) => words.has(word));
    if (holders.length === 1) return holders[0].entry;
  }
  return undefined;
}

/** How well a question matches an FAQ entry: the share of the question's own
 *  keywords that the entry's question contains, from two words up. */
function faqScore(question: string[], entry: string[]) {
  if (question.length === 0) return 0;
  const pool = new Set(entry);
  const hits = question.filter((word) => pool.has(word)).length;
  // One shared word is a coincidence: "where has he worked" against "did you
  // work closely with the team".
  return hits >= 2 ? hits / question.length : 0;
}

const GREETINGS = ["hi", "hello", "hey", "hiya", "yo", "namaste", "good morning", "good evening", "good afternoon", "sup"];

export interface TarsLines {
  greeting: string;
  self: string;
  thanks: string;
  unknown: string;
}

export function answer(rawQuestion: string, k: BotKnowledge, lines: TarsLines): BotReply {
  const text = normalise(rawQuestion);
  const words = keywords(rawQuestion);

  if (!text) return { text: lines.greeting };

  if (anyOf(text, ["tars", "who are you", "what are you", "your name", "humor", "humour", "honesty"])) {
    return { text: lines.self };
  }
  if (anyOf(text, ["thanks", "thank you", "thx", "cheers"])) return { text: lines.thanks };
  if (anyOf(text, ["what does he do", "what do you do", "what does saikiran do", "who is", "who's", "introduce", "about him", "about saikiran", "summary", "overview"])) {
    const [latest] = k.roles;
    return {
      text: `${k.name} is a ${k.headline}, based in ${k.location}.${latest ? ` Most recently: ${latest.role} at ${latest.company}.` : ""}`,
      links: [{ label: "Résumé", href: "/resume" }, { label: "Projects", href: "/projects" }],
    };
  }
  if (words.length === 0 || (GREETINGS.some((g) => mentions(text, g)) && words.length <= 2)) {
    return { text: lines.greeting };
  }

  // A project by name beats everything: "tell me about certisafe".
  const project = k.projects.find((p) => spellings(p.title).some((form) => mentions(text, form)));
  if (project) return projectReply(k, project);

  // A company by name: "what did he do at aude".
  const companies = k.roles.filter((role) =>
    spellings(role.company.replace(/\s+(private\s+)?limited$/i, "")).some((form) => mentions(text, form)) ||
    mentions(text, normalise(role.company.split(/[\s.]/)[0])),
  );
  if (companies.length) return rolesReply(companies);

  // A strong FAQ match first: those are his own answers.
  const scored = k.faq
    .map((entry) => ({ entry, score: faqScore(words, keywords(entry.question)) }))
    .sort((a, b) => b.score - a.score);
  if (scored[0] && scored[0].score >= 0.6) return faqReply(k, scored[0].entry);

  // Named skills: "does he know react and docker".
  const skills = k.skills.filter((skill) => spellings(skill.name).some((form) => mentions(text, form)));
  if (skills.length) return skillsReply(k, skills);

  // An area of the skill web: "does he do machine learning", "devops".
  const area = k.areas.find((a) =>
    [a.label, ...a.label.split(/\s*[/&]\s*/)].some((name) => spellings(name).some((form) => mentions(text, form))),
  );
  if (area && area.skills.length) {
    return {
      text: `For ${area.label}, ${k.name}'s stack has ${list(area.skills)}.`,
      links: [{ label: "Explore the skill web", href: "/skills" }],
    };
  }

  if (anyOf(text, ["email", "contact", "reach", "hire", "hiring", "get in touch", "message", "linkedin", "phone"])) {
    return {
      text: `You can email ${k.name} at ${k.email}, or use the contact form at the bottom of the home page.`,
      links: [{ label: "Contact form", href: "/#contact" }, { label: `Email ${k.name}`, href: `mailto:${k.email}` }, ...k.profiles],
    };
  }
  if (anyOf(text, ["resume", "cv", "curriculum vitae", "pdf"])) {
    return {
      text: `There's a one-page résumé and a full CV, both downloadable as PDFs.`,
      links: [{ label: "Résumé", href: "/resume" }, { label: "Full CV", href: "/cv" }],
    };
  }
  const whereabouts = () => {
    const [, ...rest] = k.availability.split(" · ");
    return { text: `${k.name} is based in ${k.location}.${rest.length ? ` ${rest.join(" · ")}.` : ""}` };
  };
  if (anyOf(text, ["location", "located", "based", "live", "city", "country", "relocate", "relocation", "remote", "onsite", "on site", "hybrid"])) {
    return whereabouts();
  }
  if (anyOf(text, ["degree", "college", "university", "education", "study", "studied", "graduate", "graduated", "graduation", "cgpa", "gpa", "btech", "b.tech"])) {
    const { degree, institution, period, cgpa } = k.education;
    return { text: `${degree}, ${institution} (${period}), CGPA ${cgpa}.`, links: [{ label: "Full CV", href: "/cv" }] };
  }
  if (anyOf(text, ["experience", "work", "worked", "job", "jobs", "intern", "internship", "internships", "role", "roles", "company", "companies", "career", "employ", "employed"])) {
    return rolesReply(k.roles);
  }
  // Only now a bare "where": "where has he worked" was about work.
  if (mentions(text, "where")) return whereabouts();
  if (anyOf(text, ["project", "projects", "built", "build", "made", "portfolio", "app", "apps", "work samples", "case study", "case studies"])) {
    const featured = k.projects.filter((p) => p.featured);
    const shown = (featured.length ? featured : k.projects).slice(0, 4);
    return {
      text: `${k.name} has ${k.projects.length} projects written up as case studies, including ${list(shown.map((p) => shortTitle(p.title)))}.`,
      links: [...shown.map((p) => ({ label: shortTitle(p.title), href: `/projects/${p.slug}` })), { label: "All projects", href: "/projects" }],
    };
  }
  if (anyOf(text, ["skill", "skills", "stack", "tech", "technology", "technologies", "language", "languages", "framework", "frameworks", "tools"])) {
    const categories = [...new Set(k.skills.map((skill) => skill.category))];
    return {
      text: `${k.name}'s stack covers ${list(categories)}: ${k.skills.length} skills in all, each with how it's used.`,
      links: [{ label: "Explore the skill web", href: "/skills" }],
    };
  }

  // A weaker FAQ match is still better than nothing.
  if (scored[0] && scored[0].score >= 0.4) return faqReply(k, scored[0].entry);
  const rare = rareWordMatch(words, k.faq);
  if (rare) return faqReply(k, rare);

  return { text: lines.unknown, unknown: true };
}
