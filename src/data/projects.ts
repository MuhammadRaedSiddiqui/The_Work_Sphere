import type { Project } from "../types";
import { CARD_COUNT, TOTAL_CARDS } from "../constants";

// Stable-index slot 0 is project 0, etc.; the first slots hold real records,
// later ones stay empty and render the "coming soon" placeholder (§1, §13).
export const projects: (Project | null)[] = (() => {
  const slots: (Project | null)[] = new Array(TOTAL_CARDS).fill(null);
  const records: Project[] = [
    {
      id: "personal-ai-employee",
      title: "Personal AI Employee",
      thumbnail: "/img/projects/personal-ai-employee/thumb.jpg",
      heroImage: "/img/projects/personal-ai-employee/hero.jpg",
      summary: "Autonomous 24/7 business automation integrating multi-channel workflows.",
      year: "2026",
      role: "Solo — design + engineering",
      techStack: ["Python", "Claude Code", "Obsidian", "Playwright", "Odoo", "Docker"],
      status: "shipped",
      content:
        "## Overview — Autonomous business automation system for 24/7 operations. Eliminates manual admin overhead by monitoring channels, drafting actions, executing workflows. ## Approach — Distributed dual-agent setup: cloud drafting agent + local execution agent synced via Git. Obsidian vault for human-in-the-loop state, Python watchers (Gmail, WhatsApp, filesystem), MCP servers interfacing Odoo 17 ERP. ## Outcome — Full operational status across four service tiers, 41 custom MCP tools, automated financial reporting, interactive approval flows with audit trails.",
      gallery: [],
      links: { repo: "https://github.com/MuhammadRaedSiddiqui/Personal-AI-Employee-FTE" },
    },
    {
      id: "crm-digital-fte",
      title: "CRM Digital FTE",
      thumbnail: "/img/projects/crm-digital-fte/thumb.jpg",
      heroImage: "/img/projects/crm-digital-fte/hero.jpg",
      summary: "24/7 autonomous support agent streaming tickets through Kafka.",
      year: "2026",
      role: "Solo — design + engineering",
      techStack: ["FastAPI", "Apache Kafka", "PostgreSQL", "Next.js", "Python", "Docker"],
      status: "shipped",
      content:
        "## Overview — Autonomous 24/7 customer support agent managing tickets across Gmail, WhatsApp, web forms. Eliminates third-party CRM overhead using PostgreSQL + pgvector as unified CRM/knowledge base. ## Approach — FastAPI backend + Apache Kafka event streaming, Groq-powered Llama 3.3 70B function calling, local Ollama embeddings for semantic search, Next.js operator dashboard with WebSocket supervision. ## Outcome — Fully containerized deployment with automated cross-channel resolution, MCP server integration, robust Kafka consumer pipelines.",
      gallery: [],
      links: { repo: "https://github.com/MuhammadRaedSiddiqui/-CRM-Digital-FTE" },
    },
    {
      id: "agent-forge",
      title: "Agent Forge",
      thumbnail: "/img/projects/agent-forge/thumb.jpg",
      heroImage: "/img/projects/agent-forge/hero.jpg",
      summary: "Automated voice-assistant client onboarding with human-in-the-loop validation.",
      year: "2026",
      role: "Solo — design + engineering",
      techStack: ["Python", "Supabase", "Docker", "Pytest", "Make.com", "Vapi API"],
      status: "shipped",
      content:
        "## Overview — Automates client onboarding and infrastructure deployment across voice platforms (Vapi, Make.com, Supabase, cloud hosting). Turns conversational intake into auditable provisioning pipeline. ## Approach — Orchestration layer with specialist agents generating task execution graphs, managing DB migrations, deploying Make.com blueprints. Mandatory human approval gates, state machines, tamper-evident audit logs. ## Outcome — Interactive CLI backed by 600+ unit, contract, integration, and failure-injection test cases.",
      gallery: [],
      links: { repo: "https://github.com/MuhammadRaedSiddiqui/agentforge" },
    },
    {
      id: "finance-tracker",
      title: "Finance Tracker",
      thumbnail: "/img/projects/finance-tracker/thumb.jpg",
      heroImage: "/img/projects/finance-tracker/hero.jpg",
      summary: "Multi-tenant expense tracker with automated budgets and real-time analytics.",
      year: "2026",
      role: "Solo — design + engineering",
      techStack: ["React", "TypeScript", "Express", "Supabase", "Tailwind CSS", "Clerk"],
      status: "shipped",
      content:
        "## Overview — Full-stack multi-tenant expense management for individuals and organizations. Multi-currency, automated recurring transactions, customizable spending limits with alerts. ## Approach — React 19 + Express 5 REST API, Supabase PostgreSQL with RLS and real-time WebSocket syncing, Clerk JWT auth, React Query for offline persistence. ## Outcome — Production-ready platform with Playwright E2E testing, rate-limited endpoints, automated CSV/PDF reporting.",
      gallery: [],
      links: { repo: "https://github.com/MuhammadRaedSiddiqui/expense-tracker-starter" },
    },
    {
      id: "devdocs-ai",
      title: "DevDocs AI",
      thumbnail: "/img/projects/devdocs-ai/thumb.jpg",
      heroImage: "/img/projects/devdocs-ai/hero.jpg",
      summary: "Full-stack AI documentation and scaffolding platform in a monorepo.",
      year: "2026",
      role: "Solo — design + engineering",
      techStack: ["Next.js", "TypeScript", "Express", "Turborepo", "Drizzle ORM", "Zod"],
      status: "in-progress",
      content:
        "## Overview — Developer platform streamlining technical documentation, project scaffolding, AI-assisted workflow planning. Unified system for AI streaming, auth, structured asset management. ## Approach — Turborepo + pnpm monorepo, Next.js 14 App Router + Express API for dual-provider AI streaming, Drizzle ORM, shared types + Zod schemas across workspaces. ## Outcome — Core architecture, dual-provider AI streaming, CI/CD pipelines established; schema migrations actively scaling.",
      gallery: [],
      links: { repo: "https://github.com/MuhammadRaedSiddiqui/Devdocs" },
    },
    {
      id: "estate-ease",
      title: "Estate Ease",
      thumbnail: "/img/projects/estate-ease/thumb.jpg",
      heroImage: "/img/projects/estate-ease/hero.jpg",
      summary: "Cross-platform rental app prioritizing listing freshness and transparent costs.",
      year: "2026",
      role: "Solo — design + engineering",
      techStack: ["React Native", "Expo", "TypeScript", "Express", "Redux Toolkit", "Firebase"],
      status: "in-progress",
      content:
        "## Overview — Cross-platform mobile rental app for trustworthy residential rentals in Karachi. Verifiable listing freshness, community-driven unavailability reporting, transparent true monthly cost. ## Approach — React Native + Expo SDK 57, Redux Toolkit, feature-first modular architecture. Express API + Firebase Admin SDK with strict read/write split. ## Outcome — Functional mock-mode MVP: discovery, map clustering, agent CRUD, cursor-based pagination.",
      gallery: [],
      links: { repo: "https://github.com/MuhammadRaedSiddiqui/Mobile-App-Dev-Project" },
    },
    {
      id: "physical-ai-textbook",
      title: "Physical AI Textbook",
      thumbnail: "/img/projects/physical-ai-textbook/thumb.jpg",
      heroImage: "/img/projects/physical-ai-textbook/hero.jpg",
      summary: "Custom static documentation platform for structured technical delivery.",
      year: "2025",
      role: "Solo — design + engineering",
      techStack: ["Docusaurus", "React", "Markdown", "Node.js", "GitHub Pages"],
      status: "shipped",
      content:
        "## Overview — Static documentation platform organizing and serving technical content efficiently. Structured foundation for API docs and static content delivery. ## Approach — Docusaurus + React, Markdown compiled to static assets, hot-reloading dev, automated GitHub Pages deployment. ## Outcome — Optimized static site with hot-reloading and automated CI/CD deployment pipelines.",
      gallery: [],
      links: { repo: "https://github.com/MuhammadRaedSiddiqui/physical-ai-textbook" },
    },
  ];
  records.slice(0, CARD_COUNT).forEach((p, i) => (slots[i] = p));
  return slots;
})();
