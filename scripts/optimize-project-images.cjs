#!/usr/bin/env node
/* Produces AVIF/WebP fallbacks and the shared 8×6 thumbnail atlas. */
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..", "public", "img", "projects");
const ids = [
  "personal-ai-employee","crm-digital-fte","agent-forge","finance-tracker","devdocs-ai","estate-ease","physical-ai-textbook","prompt-orchestrator","vision-index","voice-scribe","rag-pipeline-kit","agent-memory","synth-data-factory","eval-harness","deploy-pilot","log-lens","infra-graph","canary-watch","vault-console","invoice-flow","meeting-scribe","form-forge","waitlist-kit","changelog-cms","slot-engine","habit-loop","pantry-scan","transit-pulse","metric-mirror","funnel-scope","query-canvas","git-pulse","env-sync","scaffold-cli","mock-mesh","rate-gate","webhook-relay","hot-cache","audit-trail","token-forge","stream-ui","veritas","chart-kit","snippet-vault","doc-search","pixel-sort","sound-map","terminal-studio",
];
const cell = { width: 400, height: 267 };
const columns = 8;
const start = Number(process.env.IMAGE_BATCH_START ?? 0);
const count = Number(process.env.IMAGE_BATCH_COUNT ?? ids.length);
const atlasOnly = process.argv.includes("--atlas-only");

async function eachLimited(items, worker, limit = 4) {
  const queue = [...items];
  await Promise.all(Array.from({ length: limit }, async () => {
    while (queue.length) await worker(queue.shift());
  }));
}

async function encodeProject(id) {
  const dir = path.join(root, id);
  await Promise.all(["thumb", "hero"].map(async (name) => {
    const source = path.join(dir, `${name}.jpg`);
    const resize = name === "thumb" ? { width: 800, withoutEnlargement: true } : { width: 1600, withoutEnlargement: true };
    await sharp(source).resize(resize).avif({ quality: name === "thumb" ? 48 : 52, effort: 4 }).toFile(path.join(dir, `${name}.avif`));
    await sharp(source).resize(resize).webp({ quality: name === "thumb" ? 68 : 72, effort: 4 }).toFile(path.join(dir, `${name}.webp`));
  }));
}

async function main() {
  const batch = ids.slice(start, start + count);
  if (!atlasOnly) await eachLimited(batch, encodeProject, 1);
  if (!atlasOnly && batch.length !== ids.length) {
    console.log(`[optimize-project-images] Encoded batch ${start + 1}-${start + batch.length} of ${ids.length}.`);
    return;
  }
  const inputs = ids.map((id, index) => ({
    input: path.join(root, id, "thumb.jpg"),
    left: (index % columns) * cell.width,
    top: Math.floor(index / columns) * cell.height,
  }));
  const atlas = sharp({
    create: { width: columns * cell.width, height: Math.ceil(ids.length / columns) * cell.height, channels: 3, background: "#33333a" },
  }).composite(await Promise.all(inputs.map(async ({ input, left, top }) => ({ input: await sharp(input).resize(cell.width, cell.height, { fit: "cover" }).toBuffer(), left, top }))));
  await atlas.clone().avif({ quality: 48, effort: 5 }).toFile(path.join(root, "thumbnail-atlas.avif"));
  await atlas.webp({ quality: 70, effort: 5 }).toFile(path.join(root, "thumbnail-atlas.webp"));
  console.log(`[optimize-project-images] Encoded ${ids.length} thumbnails/heroes and one atlas.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
