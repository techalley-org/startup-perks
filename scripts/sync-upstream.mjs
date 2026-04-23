import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, "config", "upstream-selection.json");
const upstreamRoot = process.env.UPSTREAM_REPO_DIR
  ? path.resolve(process.env.UPSTREAM_REPO_DIR)
  : path.join(repoRoot, ".cache", "upstream-startup-perks");
const localOnlyFields = ["featured", "partnerOnly", "sortOrder"];

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

  const upstreamRaw = await readFile(upstreamFile, "utf8");
  const localRaw = await readLocalFileIfPresent(localFile);
  const mergedRaw = mergePerkMarkdown({
    upstreamRaw,
    localRaw,
    localSlug
  });

  await writeFile(localFile, mergedRaw, "utf8");
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

async function readLocalFileIfPresent(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function mergePerkMarkdown({ upstreamRaw, localRaw, localSlug }) {
  const upstreamParsed = parseMarkdownWithFrontmatter(upstreamRaw, `${localSlug} (upstream)`);

  if (!localRaw) {
    return serializeMarkdown(upstreamParsed.data, upstreamParsed.body);
  }

  const localParsed = parseMarkdownWithFrontmatter(localRaw, `${localSlug} (local)`);
  const mergedData = { ...upstreamParsed.data };

  for (const field of localOnlyFields) {
    if (field in localParsed.data) {
      mergedData[field] = localParsed.data[field];
    }
  }

  if (shouldPreferLocalDate(localParsed.data.lastVerified, upstreamParsed.data.lastVerified)) {
    mergedData.lastVerified = localParsed.data.lastVerified;
  }

  const mergedBody = localParsed.body?.trim() || upstreamParsed.body;
  return serializeMarkdown(mergedData, mergedBody);
}

function shouldPreferLocalDate(localDate, upstreamDate) {
  if (!localDate) {
    return false;
  }
  if (!upstreamDate) {
    return true;
  }
  return localDate > upstreamDate;
}

function parseMarkdownWithFrontmatter(raw, label) {
  const normalizedRaw = raw.replace(/^\uFEFF/, "");
  const match = normalizedRaw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`${label}: expected YAML-style frontmatter wrapped in --- markers.`);
  }

  const [, frontmatter, body] = match;
  return {
    data: parseSimpleYaml(frontmatter, label),
    body: body.trim()
  };
}

function parseSimpleYaml(frontmatter, label) {
  const lines = frontmatter.replace(/\r/g, "").split("\n");
  const result = {};
  let currentArrayKey = null;

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const arrayItemMatch = line.match(/^\s*-\s+(.*)$/);
    if (arrayItemMatch) {
      if (!currentArrayKey) {
        throw new Error(`${label}: array item found before an array field declaration.`);
      }
      result[currentArrayKey].push(parseScalar(arrayItemMatch[1]));
      continue;
    }

    const fieldMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!fieldMatch) {
      throw new Error(`${label}: could not parse frontmatter line "${line}".`);
    }

    const [, key, rawValue] = fieldMatch;

    if (rawValue === "") {
      result[key] = [];
      currentArrayKey = key;
      continue;
    }

    result[key] = parseScalar(rawValue);
    currentArrayKey = null;
  }

  return result;
}

function parseScalar(value) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function serializeMarkdown(data, body) {
  const lines = ["---"];

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${serializeScalar(item)}`);
      }
      continue;
    }

    lines.push(`${key}: ${serializeScalar(value)}`);
  }

  lines.push("---", "");

  if (body) {
    lines.push(body.trim());
  }

  return `${lines.join("\n")}\n`;
}

function serializeScalar(value) {
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }

  const text = String(value ?? "");
  if (text === "") {
    return '""';
  }
  if (/[:#'"[\]{}]|^\s|\s$/.test(text)) {
    return JSON.stringify(text);
  }
  return text;
}
