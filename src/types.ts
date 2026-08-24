// Hero spec §13 — Content Model
export type Project = {
  id: string;
  title: string;
  thumbnail: string; // image shown on the idle card
  heroImage: string; // larger image for the expanded header
  summary?: string; // one-line tagline shown under the title
  year?: string;
  role?: string;
  techStack?: string[];
  status: "planned" | "in-progress" | "shipped";
  content?: string; // full case-study body (expanded view)
  gallery?: string[]; // additional screenshots
  links?: {
    live?: string;
    repo?: string;
  };
};
