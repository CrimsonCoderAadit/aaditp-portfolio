import { PROJECTS, shortName } from "./projects";
import { EXPERIENCE } from "./experience";
import { RESEARCH } from "./research";

/** Skills: the groups, names and notes from the previous portfolio
 * (NEWPORTFOLIO/index.html, "Skills"), which match the résumé's Technical
 * Skills. There are no proficiency levels anywhere in the sources, so none
 * are shown; evidence of use comes only from the technology lists of the
 * projects, the internship and the papers, matched by name.
 *
 * IDs are stable: they key the workshop's bays and `?skill=<id>` deep links. */

/** The workshop's one accent: the groups differ by their machines, not colour. */
const AMBER = "#e0a24c";

export type SkillCategory = {
  id: string;
  name: string;
  skills: string[];
  /** The source's own line about the group. */
  note: string;
  accent: string;
};

export const SKILL_CATEGORIES: SkillCategory[] = [
  { id: "languages", name: "Languages", skills: ["Java", "Python", "C", "TypeScript", "SQL"], note: "Python is where I'm most fluent: all my research work lives there. C taught me what the others abstract away.", accent: AMBER },
  { id: "data-science-ml", name: "Data Science / ML", skills: ["Pandas", "Matplotlib", "NLP", "PyTorch", "Scikit-learn"], note: "Where most of my research happens. Graph neural networks and transformer fine-tuning for code and text classification.", accent: AMBER },
  { id: "web", name: "Web", skills: ["HTML", "CSS", "TailwindCSS", "React.js", "Next.js"], note: "Next.js is my default for anything that needs a frontend. Most of the projects here run on it.", accent: AMBER },
  { id: "backend", name: "Backend", skills: ["Spring Boot", "REST APIs"], note: "Spring Boot from microservices coursework; REST API design across most of what I've built.", accent: AMBER },
  { id: "databases", name: "Databases", skills: ["MongoDB", "MySQL", "Oracle SQL", "PostgreSQL"], note: "PostgreSQL via Prisma in production at my internship. Comfortable across relational and document models.", accent: AMBER },
  { id: "core-cs", name: "Core CS", skills: ["Data Structures", "Operating Systems", "DBMS"], note: "The coursework foundation. Normalization, concurrency, and scheduling show up more often than I expected.", accent: AMBER },
  { id: "tools", name: "Tools", skills: ["Git", "Linux (CLI, grep, shell basics)"], note: "Daily drivers. Plus enough Windows Server and IIS to have deployed to production on it.", accent: AMBER },
  { id: "cloud", name: "Cloud", skills: ["AWS S3", "AWS Lambda"], note: "Serverless processing for CASSIAN-AI. Also deployed to Vercel and Render.", accent: AMBER },
];

export type SkillUse = { section: "projects" | "experience" | "research"; id: string; name: string;
  /** The listed technology that shows the skill, when it is not the skill's own name. */
  via?: string };
/** A piece of work with its own one-line summary, and which of a group's skills it lists. */
export type RelatedWork = SkillUse & { summary: string; skills: string[] };

/** Names compare without case, punctuation or a ".js" suffix: "React.js" is "React". */
const normalise = (name: string) => name.toLowerCase().replace(/\.js$/, "").replace(/[^a-z0-9+#]/g, "");

const SOURCES: (SkillUse & { summary: string; technologies: string[] })[] = [
  ...PROJECTS.map((project) => ({ section: "projects" as const, id: project.id, name: shortName(project), summary: project.summary, technologies: project.technologies })),
  ...EXPERIENCE.map((entry) => ({ section: "experience" as const, id: entry.id, name: `${entry.company} internship`, summary: entry.summary, technologies: entry.technologies })),
  ...RESEARCH.map((entry) => ({ section: "research" as const, id: entry.id, name: entry.shortName, summary: entry.summary, technologies: entry.tools })),
];

/** Technologies that can only be used through a skill, so listing one shows
 * the skill too: Python libraries, frameworks built on React, SQL databases
 * and NLP models and methods. Only certain implications belong here. */
const IMPLIES: Record<string, string[]> = {
  pytorch: ["python"], spacyner: ["python", "nlp"], sentencetransformers: ["python", "nlp"], networkx: ["python"], xgboost: ["python"], pyod: ["python"],
  huggingfacetransformers: ["python", "nlp"], codebertmicrosoftcodebertbase: ["nlp"], tfidf: ["nlp"],
  next: ["react"], postgresql: ["sql"],
};

/** Where the work's technology list shows this skill: by its own name, or through a technology that implies it. */
function evidence(technologies: string[], key: string) {
  const named = technologies.find((tech) => normalise(tech) === key);
  if (named) return { found: true, via: undefined };
  const via = technologies.find((tech) => IMPLIES[normalise(tech)]?.includes(key));
  return { found: via !== undefined, via };
}

/** The work whose technology list shows this skill. */
export function usesOf(skill: string): SkillUse[] {
  const key = normalise(skill);
  return SOURCES.flatMap(({ section, id, name, technologies }) => {
    const { found, via } = evidence(technologies, key);
    return found ? [{ section, id, name, via }] : [];
  });
}

/** Every piece of work that lists at least one of the group's skills, most matches first. */
export function relatedWork(category: SkillCategory): RelatedWork[] {
  const keys = category.skills.map((skill) => [skill, normalise(skill)] as const);
  return SOURCES
    .map(({ section, id, name, summary, technologies }) => {
      return { section, id, name, summary, skills: keys.filter(([, key]) => evidence(technologies, key).found).map(([skill]) => skill) };
    })
    .filter((work) => work.skills.length > 0)
    .sort((a, b) => b.skills.length - a.skills.length);
}

export function skillCategoryById(id: string | null | undefined) {
  return SKILL_CATEGORIES.find((category) => category.id === id) ?? null;
}
