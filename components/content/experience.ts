/** Professional experience: the one source of experience content for the
 * scene and the interface. Text is taken from the previous portfolio
 * (NEWPORTFOLIO/index.html, "Experience" section) and the owner's own account;
 * nothing here is invented. Fields the sources do not give (a logo, a
 * certificate, a company link) are left out rather than filled in.
 *
 * Only completed or current positions belong here. Planned or offered roles
 * are not experience yet and stay out until they begin.
 *
 * IDs are stable: they key the tower's career floors and `?experience=<id>`
 * deep links. */

/** A calendar month, as `YYYY-MM`. */
export type Month = `${number}-${string}`;
export type ExperienceLink = { kind: "company" | "certificate" | "project" | "reference"; href: string };

export type ExperienceEntry = {
  id: string;
  company: string;
  /** The short identifier printed on the tower's floor plaque. */
  companyShort: string;
  role: string;
  location?: string;
  start: Month;
  /** Absent while the position is current. */
  end?: Month;
  summary: string;
  description: string[];
  highlights: string[];
  technologies: string[];
  links: ExperienceLink[];
  accent: string;
};

export const EXPERIENCE: ExperienceEntry[] = [
  {
    id: "congruent-solutions",
    company: "Congruent Solutions",
    companyShort: "CSPL",
    role: "IT Intern",
    location: "Chennai",
    start: "2026-06",
    end: "2026-06",
    summary: "Built AFAIS, a full-stack AI / privacy / security risk-governance web app. Owned the full risk lifecycle: registration, assessment, treatment, multi-tier approvals, and governance voting, backed by a designation-driven permission engine and Active Directory authentication.",
    description: [
      "Congruent had three separate risk-assessment procedures (AI risk under ISO/IEC 42001, privacy risk under ISO/IEC 27701, and information security risk under ISO/IEC 27001), each being tracked in its own scattered set of spreadsheets. I built AFAIS to replace all three with one system.",
      "The insight that shaped the architecture was that these aren't three different problems. They're three parallel lanes running on one identical lifecycle: registration, assessment, treatment, specialist review, and governance sign-off. What differs between them is only the contextual fields and which roles are involved at each stage. Building it that way meant one engine instead of three, and one auditable trail rather than three inconsistent ones.",
      "Access control was the hardest part to get right. Risk governance is exactly the domain where \"who is allowed to approve this\" isn't a detail: it's the entire point. AFAIS ended up with a ten-tier permission model (CAIO, Governance Committee, Risk Manager, Reviewer, DPO, Legal, InfoSec, Owner, Internal Audit, Read-Only), driven by a designation-based engine rather than hardcoded role checks, with support for users holding multiple roles and switching between them. Authentication runs against the company's Active Directory over LDAP, so it slots into existing corporate identity rather than creating another credential store.",
      "Stack: Next.js and React on the frontend, Prisma over PostgreSQL for data, deployed on Windows Server behind IIS reverse proxies with HTTPS, running as always-on scheduled tasks. I took it to production across multiple servers (a test environment and a live production environment) and validated the whole thing with an automated end-to-end test suite.",
      "The deployment work taught me more than the application code did. One bug cost me a genuinely embarrassing amount of time: LDAP binds were failing with error 49, apparently at random. The cause turned out to be PowerShell here-string variable expansion silently eating part of the bind password when writing the environment file: the password in the config was quietly not the password I'd set. Nothing in the error message pointed anywhere near the real cause. It's the clearest lesson I've had in how deployment environments fail in ways that local development never surfaces.",
      "I closed the internship out with two formal deliverables: a Developer & Maintenance Manual covering architecture, the permission model, database schema, full hosting setup, and troubleshooting; and a User Manual covering day-to-day use for the people who'd actually be operating it.",
    ],
    highlights: [
      "Built AFAIS to replace three spreadsheet-tracked risk procedures (AI under ISO/IEC 42001, privacy under ISO/IEC 27701, information security under ISO/IEC 27001) with one system",
      "Modelled all three as parallel lanes on one lifecycle: registration, assessment, treatment, specialist review and governance sign-off",
      "Implemented a ten-tier, designation-driven permission model with multi-role users, authenticated against Active Directory over LDAP",
      "Deployed to test and live production on multiple Windows servers behind IIS reverse proxies with HTTPS, validated by an automated end-to-end test suite",
      "Delivered a Developer & Maintenance Manual and a User Manual",
    ],
    technologies: ["Next.js", "React", "Prisma", "PostgreSQL", "LDAP", "IIS", "HTTPS", "End-to-end testing"],
    links: [],
    accent: "#e9c07a",
  },
];

/** Oldest first: the order the tower's floors rise in. */
export const CAREER = [...EXPERIENCE].sort((a, b) => a.start.localeCompare(b.start));

export function experienceById(id: string | null | undefined) {
  return EXPERIENCE.find((entry) => entry.id === id) ?? null;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (month: Month) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
export const startYear = (entry: ExperienceEntry) => Number(entry.start.slice(0, 4));

/** "June 2026", "June – August 2026", "June 2026 – Present". */
export function dateRange({ start, end }: ExperienceEntry) {
  if (!end) return `${monthName(start)} – Present`;
  if (end === start) return monthName(start);
  if (end.slice(0, 4) === start.slice(0, 4)) return `${MONTHS[Number(start.slice(5, 7)) - 1]} – ${monthName(end)}`;
  return `${monthName(start)} – ${monthName(end)}`;
}
