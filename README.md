# Tech Alley Startup Perks

This repository is the source of truth for the Tech Alley startup perks directory.

It stores startup discount and credit listings as markdown content in `src/content/perks/` and exports two machine-readable files:

- `perks.json`: primary export for Wix CMS sync
- `perks.csv`: spreadsheet-friendly export for manual review or import

Tech Alley should maintain perk content here first, then sync the generated data into Wix for member-only delivery on `techalley.org`.

## Repo structure

```text
.
|-- src/content/perks/    # One markdown file per perk
|-- scripts/             # Export and validation tooling
|-- docs/                # Implementation notes for Wix
|-- perks.json           # Generated JSON export
`-- perks.csv            # Generated CSV export
```

## How it works

1. Add or update a perk file in `src/content/perks/`
2. Run `npm run validate`
3. Run `npm run build`
4. Sync `perks.json` into the Wix CMS collection
5. Show the collection on a members-only Wix page

## Upstream sync automation

This repo can selectively mirror perk files from `jnd0/startup-perks` using a scheduled GitHub Action.

- Selection is controlled in `config/upstream-selection.json`
- The workflow lives at `.github/workflows/sync-upstream-perks.yml`
- The sync script lives at `scripts/sync-upstream.mjs`
- The action opens a pull request instead of writing directly to `main`

The workflow currently runs every Monday at 14:17 UTC and can also be started manually from GitHub Actions.

To add another upstream listing, add a new item to `config/upstream-selection.json`:

```json
{
  "upstreamSlug": "notion-for-startups",
  "localSlug": "notion-for-startups"
}
```

`upstreamSlug` is the markdown filename from `jnd0/startup-perks` without the `.md` extension. `localSlug` is the filename that should be used in this repo.

## Content model

Each perk file contains frontmatter plus an optional markdown body.

Example:

```md
---
company: Example Co
title: Up to $5,000 in credits
summary: Short factual summary for the perk card.
perkType: credit
amountDisplay: Up to $5,000 in credits
eligibility: Early-stage startups with a valid website.
fundingStages:
  - Pre-seed
  - Seed
regions:
  - Global
categories:
  - Cloud
applyUrl: https://example.com/startups
sourceUrl: https://example.com/startups
lastVerified: 2026-04-23
verified: true
isActive: true
featured: false
partnerOnly: false
sortOrder: 100
---
Optional notes that appear in the exported `body` field.
```

## Commands

```bash
npm run sync-upstream
npm run validate
npm run build
```

Both commands use the same script:

- `sync-upstream` copies selected markdown files from a checked-out upstream repo
- `validate` checks that required fields, URLs, booleans, and dates are valid
- `build` validates content and regenerates `perks.json` and `perks.csv`

## Wix integration

Recommended setup:

1. Create a Wix CMS collection named `StartupPerks`
2. Restrict the page to members only
3. Restrict CMS collection read access to members only
4. Import or sync `perks.json` into Wix
5. Build a dynamic list page and dynamic item page for members

See [docs/wix-cms-schema.md](docs/wix-cms-schema.md) for the suggested collection fields.

## Wix CMS sync automation

This repo includes a GitHub Action that can sync `perks.json` into a Wix CMS collection after changes are merged to `main`.

Files:

- `.github/workflows/sync-wix-cms.yml`
- `scripts/sync-wix-cms.mjs`
- `config/wix-sync.json`

Required GitHub repository secrets:

- `WIX_API_KEY`
- `WIX_SITE_ID`
- `WIX_COLLECTION_ID`

The sync script maps the repo dataset to the Wix field names currently used by the `StartupPerks` collection. Based on the current exported CMS header row, the repo `title` field maps to Wix's `Title` field.

The action:

1. checks out the repo on `main`
2. reads `perks.json`
3. queries existing Wix CMS items
4. creates missing items
5. updates existing items by `sourceId`

Run manually from GitHub Actions or let it run automatically on pushes to `main` that change `perks.json` or the Wix sync files.

## Editorial rules

- Use one file per public perk or program
- Tie every listing to an official source URL
- Keep summaries factual and short
- Update `lastVerified` every time a listing is reviewed
- Set `isActive: false` when a perk is discontinued or no longer reliable

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

This repository is currently licensed under the MIT License in [LICENSE](LICENSE).
