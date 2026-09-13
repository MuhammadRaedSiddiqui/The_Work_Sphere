/*
 * Static route output for the Work index and its 48 immutable case studies.
 * Vite's SSR module loader lets this script consume projects.ts directly, so
 * rendered copy cannot drift from the client source of truth.
 */
const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function caseStudySections(content = "") {
  return content
    .split(/(?=##\s+)/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^##\s+([^—\n]+(?:\s+[^—\n]+)*)\s+—\s+([\s\S]*)$/);
      if (match) return { heading: match[1].trim(), body: match[2].trim() };
      return { heading: "Case study", body: part.replace(/^##\s*/, "") };
    });
}

function documentShell({ title, description, canonicalPath, body, script }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalPath)}" />
    <title>${escapeHtml(title)} — Raed Siddiqui</title>
    <style>
      :root { color-scheme:dark; font-family:Inter,ui-sans-serif,system-ui,sans-serif; background:#000; color:#ededf0; }
      body { margin:0; background:#000; } main { max-width:780px; margin:0 auto; padding:56px 24px 96px; }
      a { color:#ededf0; text-underline-offset:4px; } .eyebrow { color:rgba(255,255,255,.5); font:12px ui-monospace,SFMono-Regular,Consolas,monospace; letter-spacing:.08em; text-transform:uppercase; }
      h1 { margin:16px 0 10px; font-size:clamp(36px,7vw,64px); line-height:1; letter-spacing:-.055em; } h2 { margin:38px 0 10px; font-size:14px; letter-spacing:.08em; text-transform:uppercase; }
      p { color:rgba(255,255,255,.75); font-size:17px; line-height:1.65; } .meta { color:rgba(255,255,255,.5); font:13px ui-monospace,SFMono-Regular,Consolas,monospace; }
      .stack { display:flex; flex-wrap:wrap; gap:7px; list-style:none; padding:0; } .stack li { border:1px solid rgba(255,255,255,.16); padding:4px 7px; font:12px ui-monospace,SFMono-Regular,Consolas,monospace; }
      img { width:100%; height:auto; display:block; margin:28px 0; border:1px solid rgba(255,255,255,.12); } .links { display:flex; gap:14px; margin-top:32px; }
    </style>
  </head>
  <body>
    <main id="root">${body}</main>
    <script type="module" src="${script}"></script>
  </body>
</html>`;
}

function workIndexMarkup(projects) {
  const rows = projects.map((project) => `<li><a href="/work/${encodeURIComponent(project.id)}">${escapeHtml(project.title)}</a> <span class="meta">${escapeHtml(project.year)} · ${escapeHtml(project.lane)}</span></li>`).join("\n");
  return `<a href="/" class="eyebrow">← Portfolio</a><h1>Work</h1><p>Index of selected projects.</p><ol>${rows}</ol>`;
}

function projectMarkup(project) {
  const sections = caseStudySections(project.content).map(({ heading, body }) => `<section><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(body)}</p></section>`).join("\n");
  const stack = (project.techStack ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const links = [project.links?.live && `<a href="${escapeHtml(project.links.live)}">View live →</a>`, project.links?.repo && `<a href="${escapeHtml(project.links.repo)}">View source →</a>`].filter(Boolean).join("");
  return `<a href="/work" class="eyebrow">← Work index</a>
    <article>
      <h1>${escapeHtml(project.title)}</h1>
      <p class="meta">${escapeHtml(project.year)} · ${escapeHtml(project.role)} · ${escapeHtml(project.status)}</p>
      <p>${escapeHtml(project.summary)}</p>
      <ul class="stack">${stack}</ul>
      <picture><source srcset="${escapeHtml(project.heroImage.replace(/\.jpg$/, ".avif"))}" type="image/avif" /><source srcset="${escapeHtml(project.heroImage.replace(/\.jpg$/, ".webp"))}" type="image/webp" /><img src="${escapeHtml(project.heroImage)}" alt="${escapeHtml(project.title)}" /></picture>
      ${sections}
      ${links ? `<p class="links">${links}</p>` : ""}
    </article>`;
}

async function writePage(relativePath, html) {
  const target = path.join(output, relativePath, "index.html");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, html, "utf8");
}

async function main() {
  const { createServer } = await import("vite");
  const server = await createServer({ root, appType: "custom", server: { middlewareMode: true } });
  try {
    const { projects } = await server.ssrLoadModule("/src/data/projects.ts");
    const records = projects.filter(Boolean);
    const builtIndex = await fs.readFile(path.join(output, "index.html"), "utf8");
    const script = builtIndex.match(/<script type="module" crossorigin src="([^"]+)"/i)?.[1]
      ?? builtIndex.match(/<script type="module" src="([^"]+)"/i)?.[1];
    if (!script) throw new Error("Could not find Vite's built module script in dist/index.html.");

    await writePage("work", documentShell({
      title: "Work",
      description: "Selected work by Raed Siddiqui.",
      canonicalPath: "/work",
      body: workIndexMarkup(records),
      script,
    }));
    await Promise.all(records.map((project) => writePage(path.join("work", project.id), documentShell({
      title: project.title,
      description: project.summary ?? `Case study: ${project.title}`,
      canonicalPath: `/work/${project.id}`,
      body: projectMarkup(project),
      script,
    }))));
    console.log(`[prerender-work] Wrote ${records.length + 1} static Work routes.`);
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
