const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const projectsSource = fs.readFileSync(path.join(root, "src/data/projects.ts"), "utf8");
const constantsSource = fs.readFileSync(path.join(root, "src/constants.ts"), "utf8");

const projectIds = [...projectsSource.matchAll(/^\s*id:\s*"([^"]+)",/gm)].map((match) => match[1]);
const laneValues = [...projectsSource.matchAll(/^\s*lane:\s*"([^"]+)",/gm)].map((match) => match[1]);
const expectedCountsBlock = constantsSource.match(/export const LANE_COUNTS = \{([\s\S]*?)\} as const;/)?.[1];

if (!expectedCountsBlock) {
  throw new Error("Could not read LANE_COUNTS from src/constants.ts.");
}

const expectedCounts = Object.fromEntries(
  [...expectedCountsBlock.matchAll(/^\s*(ai|tools|apps):\s*(\d+),/gm)].map((match) => [match[1], Number(match[2])]),
);

if (laneValues.length !== projectIds.length) {
  throw new Error(`Every project must have one lane: found ${laneValues.length} lanes for ${projectIds.length} projects.`);
}

const actualCounts = Object.fromEntries(Object.keys(expectedCounts).map((lane) => [lane, 0]));
for (const lane of laneValues) {
  if (!(lane in actualCounts)) {
    throw new Error(`Unknown project lane: ${lane}.`);
  }
  actualCounts[lane] += 1;
}

for (const [lane, expected] of Object.entries(expectedCounts)) {
  if (actualCounts[lane] !== expected) {
    throw new Error(`Lane ${lane} has ${actualCounts[lane]} projects; expected ${expected}.`);
  }
}

console.log(`Validated ${projectIds.length} project lanes: ${Object.entries(actualCounts).map(([lane, count]) => `${lane} ${count}`).join(", ")}.`);
