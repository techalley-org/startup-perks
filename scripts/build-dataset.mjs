import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const perksDir = path.join(repoRoot, "src", "content", "perks");
const jsonOutputPath = path.join(repoRoot, "perks.json");
const csvOutputPath = path.join(repoRoot, "perks.csv");
const validateOnly = process.argv.includes("--validate-only");

const requiredFields = [
  "company",
  "title",
  "summary",
  "perkType",
  "amountDisplay",
  "eligibility",
  "applyUrl",
  "sourceUrl",
  "lastVerified",
  "verified",
  "isActive"
];

const textFields = [
  "sourceId",
  "slug",
  "company",
  "title",
  "summary",
  "perkType",
  "amountDisplay",
  "currency",
  "eligibility",
  "applyUrl",
  "sourceUrl",
  "lastVerified",
  "body"
];

const arrayFields = ["fundingStages", "regions", "categories"];
const numberFields = ["creditValueUsd", "sortOrder"];
const booleanFields = ["verified", "isActive", "featured", "partnerOnly"];

const files = (await readdir(perksDir))
  .filter((file) => file.endsWith(".md"))
  .sort((a, b) => a.localeCompare(b));

const perks = [];

for (const file of files) {
  const fullPath = path.join(perksDir, file);
  const raw = await readFile(fullPath, "utf8");
  const perk = parsePerkFile(raw, file);
  validatePerk(perk, file);
  perks.push(perk);
}

perks.sort((a, b) => {
  const aOrder = typeof a.sortOrder === "number" ? a.sortOrder : Number.MAX_SAFE_INTEGER;
  const bOrder = typeof b.sortOrder === "number" ? b.sortOrder : Number.MAX_SAFE_INTEGER;
  return aOrder - bOrder || a.company.localeCompare(b.company) || a.title.localeCompare(b.title);
});

if (!validateOnly) {
  await writeFile(jsonOutputPath, `${JSON.stringify(perks, null, 2)}\n`, "utf8");
  await writeFile(csvOutputPath, `${toCsv(perks)}\n`, "utf8");
}

console.log(`Validated ${perks.length} perk file(s).${validateOnly ? "" : " Exported perks.json and perks.csv."}`);

function parsePerkFile(raw, fileName) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`${fileName}: expected YAML-style frontmatter wrapped in --- markers.`);
  }

  const [, frontmatter, body] = match;
  const data = parseSimpleYaml(frontmatter, fileName);
  const sourceId = fileName.replace(/\.md$/, "");

  return normalizePerk({
    sourceId,
    slug: sourceId,
    ...data,
    body: body.trim()
  });
}

function parseSimpleYaml(frontmatter, fileName) {
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
        throw new Error(`${fileName}: array item found before an array field declaration.`);
      }
      result[currentArrayKey].push(parseScalar(arrayItemMatch[1]));
      continue;
    }

    const fieldMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!fieldMatch) {
      throw new Error(`${fileName}: could not parse frontmatter line "${line}".`);
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

function normalizePerk(perk) {
  const normalized = { ...perk };

  for (const field of textFields) {
    if (field in normalized && normalized[field] != null) {
      normalized[field] = String(normalized[field]).trim();
    }
  }

  for (const field of arrayFields) {
    if (!(field in normalized) || normalized[field] == null) {
      normalized[field] = [];
      continue;
    }

    if (!Array.isArray(normalized[field])) {
      normalized[field] = [normalized[field]];
    }

    normalized[field] = normalized[field]
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  for (const field of numberFields) {
    if (!(field in normalized) || normalized[field] === "") {
      delete normalized[field];
      continue;
    }
    if (typeof normalized[field] !== "number" || Number.isNaN(normalized[field])) {
      throw new Error(`${normalized.sourceId}: field "${field}" must be numeric when present.`);
    }
  }

  for (const field of booleanFields) {
    if (!(field in normalized)) {
      normalized[field] = false;
      continue;
    }
    if (typeof normalized[field] !== "boolean") {
      throw new Error(`${normalized.sourceId}: field "${field}" must be true or false.`);
    }
  }

  return normalized;
}

function validatePerk(perk, fileName) {
  for (const field of requiredFields) {
    if (!(field in perk)) {
      throw new Error(`${fileName}: missing required field "${field}".`);
    }

    if (typeof perk[field] === "string" && !perk[field].trim()) {
      throw new Error(`${fileName}: required field "${field}" cannot be blank.`);
    }
  }

  if (!isValidDate(perk.lastVerified)) {
    throw new Error(`${fileName}: lastVerified must use YYYY-MM-DD.`);
  }

  if (!isUrl(perk.applyUrl) || !isUrl(perk.sourceUrl)) {
    throw new Error(`${fileName}: applyUrl and sourceUrl must be absolute URLs.`);
  }
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function toCsv(perksList) {
  const headers = [
    "sourceId",
    "slug",
    "company",
    "title",
    "summary",
    "body",
    "perkType",
    "amountDisplay",
    "creditValueUsd",
    "currency",
    "eligibility",
    "fundingStages",
    "regions",
    "categories",
    "applyUrl",
    "sourceUrl",
    "lastVerified",
    "verified",
    "isActive",
    "featured",
    "partnerOnly",
    "sortOrder"
  ];

  const rows = [headers.join(",")];

  for (const perk of perksList) {
    const row = headers.map((header) => {
      let value = perk[header];

      if (Array.isArray(value)) {
        value = value.join(" | ");
      }

      if (value == null) {
        value = "";
      }

      return csvEscape(String(value));
    });

    rows.push(row.join(","));
  }

  return rows.join("\n");
}

function csvEscape(value) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
