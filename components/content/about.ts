/** About: taken from the previous portfolio (NEWPORTFOLIO/index.html, the hero
 * and "About" sections) and the résumé's Summary and Education. Nothing here
 * is invented. There is no portrait in the sources, so none is shown. */

export type Interest = { name: string; line: string; link?: { label: string; href: string } };

export const ABOUT = {
  name: "Aadit Praveen Nath",
  standfirst: "Third-year CSE student. Builds security tooling by day, writes fiction by night.",
  headline: "I like systems that can be trusted, and stories that can't.",
  intro: [
    "Third-year CSE undergrad at SSN College of Engineering, Chennai, 2024–2028. Most of what I build sits close to security: risk tooling, anomaly detection, systems that have to earn trust before anyone relies on them.",
    "The rest of my time goes to fiction: writing it, and occasionally finishing it.",
  ],
  education: {
    institution: "SSN College of Engineering, Chennai",
    degree: "B.E. Computer Science and Engineering",
    years: "2024 – 2028",
    grade: "CGPA 8.569/10",
  },
  interestedIn: "Backend engineering, NLP, and data science.",
  /** The same three directions, one per line. */
  focus: ["Backend engineering", "NLP", "Data science"],
  interests: [
    { name: "Flute", line: "Ten years of practice." },
    { name: "Chess", line: "FIDE-rated.", link: { label: "FIDE profile", href: "https://ratings.fide.com/profile/33410852" } },
    { name: "Football", line: "Two years in goal for my college team." },
    { name: "Fiction", line: "Always mid-draft." },
  ] satisfies Interest[],
  longer: [
    "I grew up in England, moving around a fair bit before landing somewhere that stuck. Watford first, then Cambridge, and finally Royston, a small, genuinely charming town in Hertfordshire. It's the kind of place that shouldn't work as well as it does: a castle, a cricket field I spent most of my free hours on playing for the town team, and a Tesco that locals will defend with surprising conviction. I still think of it as home in a way that has nothing to do with which passport I'm carrying.",
    "Star Wars has been my favourite thing for about as long as I've had opinions. It started with Rebels (the show, watched as a kid) and a slowly expanding pile of Lego sets that took over more of my room than my parents strictly agreed to. What kept me in it wasn't the lightsabers so much as the fact that the universe has rules: the Force has a logic, factions have histories, choices have costs that compound across decades. That's not far off what I like about building software.",
    "My schooling took a more scenic route than most. Studlands Rise in England first, then a year in India at PSBB KKN, then back to England for Saint Mary's, and finally back to PSBB KKN, where I stayed through to the end of school before starting at SSN College of Engineering in Chennai. Moving between two countries and two school systems twice over teaches you to adapt quickly and read a room fast, which turned out to be more useful than most things I learned in either place. I've been lucky enough to see a fair bit of the world since: Singapore, the USA, the UAE, Scotland. Switzerland and New Zealand are still on the list, and I fully intend to get there.",
    "Outside of code, the constants are the flute I've played for about a decade, chess (I'm FIDE-rated, and I'll take the game) and standing in goal, which I did for two years for my college football team after years of cricket in England. Buffon and Neuer are the two I grew up admiring: both of them read the game a beat before it happens, which is the part I actually enjoy. Different pursuits, same restless attention to detail pointed at different things.",
  ],
};
