import type { Project } from "../types";
import { CARD_COUNT, TOTAL_CARDS } from "../constants";

// Stable-index slot 0 is project 0, etc.; the first slots hold real records,
// later ones stay empty and render the "coming soon" placeholder (§1, §13).
export const projects: (Project | null)[] = (() => {
  const slots: (Project | null)[] = new Array(TOTAL_CARDS).fill(null);
  const records: Project[] = [
    {
      id: "devlens",
      title: "DevLens",
      thumbnail: "/assets/thumbnails/devlens.jpg",
      heroImage: "/assets/hero/devlens.jpg",
      summary: "Inline code-review annotations rendered as a 3D dependency graph.",
      year: "2025",
      role: "Design + Build",
      techStack: ["TypeScript", "Three.js", "React"],
      status: "shipped",
      content: "Overview — DevLens turns pull-request diffs into a spatial graph so reviewers can see blast radius at a glance.",
      links: { repo: "https://github.com/example/devlens" },
    },
    {
      id: "typeflow",
      title: "Typeflow",
      thumbnail: "/assets/thumbnails/typeflow.jpg",
      heroImage: "/assets/hero/typeflow.jpg",
      summary: "A type-safe form builder that compiles to runtime validators.",
      year: "2025",
      role: "Solo project",
      techStack: ["TypeScript", "Zod", "Vite"],
      status: "in-progress",
      content: "Overview — Typeflow explores schema-first forms: author once in TS, get UI and validation for free.",
    },
    {
      id: "orbital",
      title: "Orbital",
      thumbnail: "/assets/thumbnails/orbital.jpg",
      heroImage: "/assets/hero/orbital.jpg",
      summary: "Design-system tokens visualized as an interactive orbit map.",
      year: "2024",
      role: "Design systems",
      techStack: ["React", "D3"],
      status: "shipped",
      content: "Overview — Orbital renders a token graph as orbits: primitives at the center, semantic tokens outward.",
      links: { live: "https://example.com/orbital" },
    },
    {
      id: "hollow",
      title: "Hollow",
      thumbnail: "/assets/thumbnails/hollow.jpg",
      heroImage: "/assets/hero/hollow.jpg",
      status: "planned",
    },
  ];
  records.slice(0, CARD_COUNT).forEach((p, i) => (slots[i] = p));
  return slots;
})();
