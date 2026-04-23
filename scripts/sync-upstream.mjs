import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, "config", "upstream-selection.json");
const upstreamRoot = process.env.UPSTREAM_REPO_DIR
  ? path.resolve(process.env.UPSTREAM_REPO_DIR)
  : path.join(repoRoot, ".cache", "upstream-startup-perks");

const rawConfig = await readFile(configPath, "utf8");
const config = JSON.parse(rawConfig);

if (!Array.isArray(config.perks) || config.perks.length === 0) {
  throw new Error("config/upstream-selection.json must define at least one selected perk.");
}

const sourcePerksDir = path.join(upstreamRoot, config.sourcePerksDir || "src/content/perks");
const targetPerksDir = path.join(repoRoot, "src", "content", "perks");
const cacheDir = path.join(repoRoot, ".cache");

await mkdir(targetPerksDir, { recursive: true });
await mkdir(cacheDir, { recursive: true });

const synced = [];

for (const perk of config.perks) {
  if (!perk.upstreamSlug) {
    throw new Error("Each selected perk must define an upstreamSlug.");
  }

  const upstreamFile = path.join(sourcePerksDir, `${perk.upstreamSlug}.md`);
  const localSlug = perk.localSlug || perk.upstreamSlug;
  const localFile = path.join(targetPerksDir, `${localSlug}.md`);

  await copyFile(upstreamFile, localFile);
  synced.push({
    upstreamSlug: perk.upstreamSlug,
    localSlug
  });
}

const report = {
  repository: config.repository,
  sourcePerksDir: config.sourcePerksDir || "src/content/perks",
  synced
};

await writeFile(
  path.join(cacheDir, "last-upstream-sync.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);

console.log(`Synced ${synced.length} perk file(s) from ${config.repository}.`);
