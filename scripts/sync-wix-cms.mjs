import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const datasetPath = path.join(repoRoot, "perks.json");
const configPath = path.join(repoRoot, "config", "wix-sync.json");

const apiKey = requiredEnv("WIX_API_KEY");
const siteId = requiredEnv("WIX_SITE_ID");
const collectionId = requiredEnv("WIX_COLLECTION_ID");
const baseUrl = process.env.WIX_API_BASE_URL || "https://www.wixapis.com";
const queryLimit = Number(process.env.WIX_QUERY_LIMIT || 1000);

const rawDataset = await readFile(datasetPath, "utf8");
const perks = JSON.parse(rawDataset);
const rawConfig = await readFile(configPath, "utf8");
const config = JSON.parse(rawConfig);

if (!Array.isArray(perks) || perks.length === 0) {
  throw new Error("perks.json does not contain any data items to sync.");
}

const existingItems = await fetchExistingItems({
  baseUrl,
  apiKey,
  siteId,
  collectionId,
  queryLimit
});

const existingBySourceId = new Map();
for (const item of existingItems) {
  const sourceId = item?.data?.sourceId;
  if (sourceId) {
    existingBySourceId.set(sourceId, item);
  }
}

let createdCount = 0;
let updatedCount = 0;

for (const perk of perks) {
  const mappedData = mapPerkToWixData(perk, config);
  const existingItem = existingBySourceId.get(perk.sourceId);

  if (existingItem) {
    const mergedData = {
      ...(existingItem.data || {}),
      ...mappedData
    };

    await saveItem({
      baseUrl,
      apiKey,
      siteId,
      collectionId,
      itemId: existingItem.id,
      data: mergedData
    });
    updatedCount += 1;
    continue;
  }

  await saveItem({
    baseUrl,
    apiKey,
    siteId,
    collectionId,
    itemId: perk.sourceId,
    data: mappedData
  });
  createdCount += 1;
}

console.log(
  `Wix CMS sync complete. Created ${createdCount} item(s), updated ${updatedCount} item(s), processed ${perks.length} total perk(s).`
);

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function fetchExistingItems({ baseUrl, apiKey, siteId, collectionId, queryLimit }) {
  const response = await fetch(`${baseUrl}/wix-data/v2/items/query`, {
    method: "POST",
    headers: wixHeaders({ apiKey, siteId }),
    body: JSON.stringify({
      dataCollectionId: collectionId,
      query: {
        paging: {
          limit: queryLimit,
          offset: 0
        }
      }
    })
  });

  const payload = await parseJsonResponse(response, "query existing Wix CMS items");
  return payload.dataItems || [];
}

async function saveItem({ baseUrl, apiKey, siteId, collectionId, itemId, data }) {
  const response = await fetch(`${baseUrl}/wix-data/v2/items/save`, {
    method: "POST",
    headers: wixHeaders({ apiKey, siteId }),
    body: JSON.stringify({
      dataCollectionId: collectionId,
      dataItem: {
        id: itemId,
        data
      }
    })
  });

  await parseJsonResponse(response, `save Wix CMS item ${itemId}`);
}

function wixHeaders({ apiKey, siteId }) {
  return {
    "Content-Type": "application/json",
    Authorization: apiKey,
    "wix-site-id": siteId
  };
}

async function parseJsonResponse(response, action) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`${action} failed (${response.status}): ${text}`);
  }

  return data;
}

function mapPerkToWixData(perk, config) {
  const mapped = {};

  for (const [wixField, sourceField] of Object.entries(config.fieldMap)) {
    mapped[wixField] = normalizeFieldValue(wixField, perk[sourceField]);
  }

  return mapped;
}

function normalizeFieldValue(wixField, value) {
  if (Array.isArray(value)) {
    return value.join(" | ");
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value;
  }

  if (value == null) {
    if (["creditValueUsd", "sortOrder"].includes(wixField)) {
      return null;
    }
    if (["verified", "isActive", "featured", "partnerOnly"].includes(wixField)) {
      return false;
    }
    return "";
  }

  return String(value);
}
