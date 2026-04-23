# Wix CMS Schema

Recommended collection name: `StartupPerks`

Recommended fields:

| Field | Type | Notes |
| --- | --- | --- |
| `sourceId` | Text | Unique key. Use the markdown filename without extension. |
| `slug` | Text | URL-safe slug used in Wix dynamic pages. |
| `company` | Text | Company/program owner. |
| `title` | Text | Public perk title. |
| `summary` | Rich text or text | Short summary for cards and listings. |
| `body` | Rich text or text | Long-form notes from the markdown body. |
| `perkType` | Text | Example: `credit`, `discount`, `free-plan`, `trial`. |
| `amountDisplay` | Text | Human-readable amount shown to members. |
| `creditValueUsd` | Number | Numeric value if known. Optional. |
| `currency` | Text | Usually `USD`. Optional. |
| `eligibility` | Text | Short eligibility summary. |
| `fundingStages` | Tags or text | Store as an array if your sync path supports it. |
| `regions` | Tags or text | Store as an array if supported. |
| `categories` | Tags or text | Store as an array if supported. |
| `applyUrl` | URL | Application page. |
| `sourceUrl` | URL | Official source page. |
| `lastVerified` | Date | Date the perk was last checked. |
| `verified` | Boolean | Whether Tech Alley has checked the listing. |
| `isActive` | Boolean | Whether the perk is currently active. |
| `featured` | Boolean | Tech Alley editorial flag. |
| `partnerOnly` | Boolean | Optional Tech Alley business rule flag. |
| `sortOrder` | Number | Optional manual ordering field. |

## Permissions

- Page access: members only
- Collection read access: members only
- Collection write access: admin only

## Sync model

This repo should remain the editorial source of truth.

Suggested flow:

1. Maintain perk entries in `src/content/perks/*.md`
2. Run the export script to generate `perks.json` and `perks.csv`
3. Sync `perks.json` into the Wix `StartupPerks` collection
4. Preserve Tech Alley-only fields in Wix if they are not managed by the repo
