/** Achievements: the six results listed in the previous portfolio
 * (NEWPORTFOLIO/index.html, "Achievements"), which match the résumé. Years
 * appear only where an event's own name carries one; no dates are guessed.
 * No certificate or evidence files exist in the sources, so none are offered.
 *
 * IDs are stable: they key the plaza's plinths and `?achievement=<id>` deep links. */

export type Achievement = {
  id: string;
  event: string;
  result: string;
  year?: number;
  description: string;
  /** The project built for it, where the source names one. */
  projectId?: string;
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: "ieee-masathon", event: "IEEE Masathon", result: "1st Place", description: "Built STRATA, a CNN ensemble classifying post-disaster satellite imagery for damage triage. Won first place in the AI track.", projectId: "strata" },
  { id: "barclays-hack-o-hire-2026", event: "Barclays Hack-o-Hire 2026", result: "Finalist · Top 10", year: 2026, description: "Built Crib-Eyes, a SOC tool that detects anomalies and drafts its own incident response playbooks. A national-level competition run by Barclays: reaching the final ten meant clearing multiple technical rounds against a large field.", projectId: "crib-eyes" },
  { id: "gdg-hackathon", event: "Google Developer Groups Hackathon", result: "10th Place", description: "Built ACADEX-AI, an academic schedule manager with dynamic timetabling, attendance tracking, and a bunk calculator. Placed tenth overall.", projectId: "acadex-ai" },
  { id: "zenith-2026", event: "Zenith Hackathon SSN 2026", result: "Finalist", year: 2026, description: "Built CASSIAN-AI, a codebase analysis system generating filetree dependency graphs on a serverless AWS pipeline. Reached the final round of my college's flagship hackathon.", projectId: "cassian-ai" },
  { id: "zenith-2025", event: "Zenith Hackathon SSN 2025", result: "Special Mention", year: 2025, description: "Awarded a special mention at the 2025 edition, my first hackathon, and the one that got me hooked on building under time pressure." },
  { id: "smart-india-hackathon", event: "Smart India Hackathon", result: "Cleared Internal", description: "Cleared the institutional selection round of India's largest national hackathon initiative." },
];

/** From the résumé's "Workshops & Certifications"; no certificate files exist. */
export const CERTIFICATIONS = [
  { name: "Text Analysis & Information Extraction Workshop", issuer: "NPTEL", year: 2025 },
  { name: "Ethical Hacking", issuer: "CSI" },
  { name: "Workshop: Microservices & Containerization" },
];

export function achievementById(id: string | null | undefined) {
  return ACHIEVEMENTS.find((entry) => entry.id === id) ?? null;
}
