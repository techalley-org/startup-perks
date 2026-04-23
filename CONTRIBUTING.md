# Contributing

This repository is the source of truth for the Tech Alley startup perks directory.

## Add a perk

1. Create a new markdown file in `src/content/perks/`.
2. Use a kebab-case filename such as `notion-for-startups.md`.
3. Fill in the required frontmatter fields.
4. Keep all claims tied to an official source URL.
5. Run `npm run validate`.
6. Run `npm run build`.
7. Open a pull request.

## Required fields

- `company`
- `title`
- `summary`
- `perkType`
- `amountDisplay`
- `eligibility`
- `applyUrl`
- `sourceUrl`
- `lastVerified`
- `verified`
- `isActive`

## Notes

- Use the official program page as `sourceUrl` whenever possible.
- Put only one perk/program per file.
- Keep summaries factual and short.
- If a perk expires or becomes unclear, set `isActive: false` or update the summary to reflect uncertainty.
