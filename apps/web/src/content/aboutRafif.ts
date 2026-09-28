// Written by Rafif for the game (2026-09-28). Content, all rights reserved (NOTICE.md).
export const FACTS: readonly string[] = [
  "I've been watching Formula 1 since 2010.",
  "Sebastian Vettel got me into F1; Max Verstappen keeps me watching.",
  "Red Bull Racing has been my F1 team for years.",
  "I support Liverpool because of my dad.",
  "I recently got addicted to tennis.",
  "My forehand is still a work in progress, but my racket research is already professional-grade.",
  "I can spend more time comparing tennis rackets than actually playing tennis.",
  "I run my own homelab for fun.",
  "Apparently managing servers after work counts as a hobby for me.",
  "I enjoy fixing DNS problems way more than I probably should.",
  "I like building systems, then monitoring the systems that monitor those systems.",
  "I once turned “I want to learn DevOps” into a full homelab project.",
  "I’m the type of person who turns hobbies into research projects.",
  "If I get curious about something, I usually go way too deep into it.",
  "I started in software development and somehow ended up enjoying infrastructure more.",
  "I like both sports strategy and system architecture for basically the same reason: everything is connected.",
  "I can talk about CI/CD, F1 strategy, and tennis equipment in the same conversation.",
  "I like projects more when I can actually deploy and operate them myself.",
  "I’m always trying to turn side projects into something useful, sellable, or at least portfolio-worthy.",
  "My idea of “relaxing” can involve debugging a server, watching F1, or playing tennis.",
];

/** Rafif's picks for the personality card: facts 1, 4, 8, 13, 17 and 20. */
export const FAVORITES: readonly number[] = [0, 3, 7, 12, 16, 19];

export const ABOUT_TXT = [
  "Rafif Dzaky Daniswara built Pit Wall On-Call.",
  "",
  ...FACTS.map((fact, i) => `${String(i + 1).padStart(2, " ")}. ${fact}`),
].join("\n");
