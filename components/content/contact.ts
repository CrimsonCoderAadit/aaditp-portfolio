/** Contact: the public channels from the previous portfolio
 * (NEWPORTFOLIO/index.html, hero and "Contact"). The phone number listed there
 * is left out on purpose: this site publishes only channels meant for anyone. */

export type ContactChannel = { id: string; label: string; value: string; href: string; action: string };

export const EMAIL = "aaditp07@gmail.com";

export const CONTACT_CHANNELS: ContactChannel[] = [
  { id: "email", label: "Email", value: EMAIL, href: `mailto:${EMAIL}`, action: "Send email" },
  { id: "linkedin", label: "LinkedIn", value: "aadit-p", href: "https://www.linkedin.com/in/aadit-p-11476b329/", action: "LinkedIn" },
  { id: "github", label: "GitHub", value: "CrimsonCoderAadit", href: "https://github.com/CrimsonCoderAadit", action: "GitHub" },
  { id: "scholar", label: "Google Scholar", value: "Aadit Praveen Nath", href: "https://scholar.google.com/citations?user=-ajqzmsAAAAJ&hl=en", action: "Google Scholar" },
  { id: "leetcode", label: "LeetCode", value: "LePrinceEcarlate", href: "https://leetcode.com/u/LePrinceEcarlate/", action: "LeetCode" },
  { id: "fide", label: "FIDE", value: "Chess rating profile", href: "https://ratings.fide.com/profile/33410852", action: "FIDE profile" },
];
