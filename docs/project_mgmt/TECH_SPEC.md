# Etched — Technical Specification

**Product Name:** Etched
**Date:** September 12, 2026
**Version:** 1.0

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                 SvelteKit (Svelte 5, App Router-style)        │
│  src/routes/+page.server.ts  →  loadCards()                   │
│  src/routes/+page.svelte     →  filter UI + card grid         │
│  src/lib/components/Card.svelte → single card (flip/tilt)     │
└───────────────┬─────────────────────────────────────────────┘
                │ server-side load, per request
                ▼
┌─────────────────────────────────────────────────────────────┐
│  src/lib/cards.server.ts                                      │
│  - globs src/content/*.md (mdsvex, eager)                     │
│  - merges frontmatter with a Wikidata lookup per card          │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│  src/lib/wikidata.ts                                          │
│  - SPARQL query to query.wikidata.org per wikidataId           │
│  - in-memory cache (1h TTL) to avoid re-fetching every request │
│  - builds a Commons Special:FilePath image URL as a fallback   │
└─────────────────────────────────────────────────────────────┘
```

There is no database and no backend service beyond SvelteKit's own server-side rendering. All "data" is either a markdown file in the repo (`src/content/`) or fetched live from Wikidata's public SPARQL endpoint. Deployed on Vercel (`@sveltejs/adapter-vercel`).

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | SvelteKit (Svelte 5, runes mode) | `svelte.config.js` forces runes mode project-wide |
| Content | mdsvex | `.md` files in `src/content/` compiled as Svelte components (frontmatter → `metadata`, body → `default` component) |
| Styling | Component-scoped `<style>` blocks | No CSS framework; hand-rolled dark/holographic card aesthetic |
| Data source | Wikidata SPARQL + Wikimedia Commons | `src/lib/wikidata.ts` — no API key required, public endpoints |
| Testing | Vitest (unit) + Playwright (e2e) | `pnpm test:unit`, `pnpm test:e2e` |
| Formatting | Prettier (`prettier-plugin-svelte`) | `pnpm lint` / `pnpm format` |
| Hosting | Vercel | `@sveltejs/adapter-vercel` in `svelte.config.js` |
| Package manager | pnpm | see root `CLAUDE.md` |

---

## 3. Access Model

None. There is no auth, no roles, no per-user data. The single route (`/`) is public and identical for every visitor. All mutation happens offline, by the site owner editing files and pushing a deploy — not through the running app.

---

## 4. Content Model

Cards live as markdown files in `src/content/*.md`. Frontmatter shape (`CardFrontmatter`, `src/lib/cards.server.ts`):

| Field | Required | Notes |
|-------|----------|-------|
| `name` | yes | Display name |
| `type` | yes | `'mythical' \| 'historical'` — drives the type filter and card accent color (`domain-colors.ts`) |
| `era` | yes | Free-text era label shown as a tag (`ancient`, `modern`, etc.) |
| `domain` | yes | `string[]` — drives the domain filter; each value gets a deterministic color via a hash (`getDomainPalette`) |
| `wikidataId` | no | Wikidata Q-number; when present, enables live enrichment (description, born/died, occupations, fallback portrait) and a "Learn more" link to Wikipedia |
| `image` | no | Local static path (e.g. `/ada-lovelace.png`). **Always wins** over any Wikidata-derived image — see §6 |

The markdown body is compiled as a Svelte component and rendered inside the card's flip panel alongside the Wikidata description.

Two scripts support content growth:
- **`scripts/seed-women.ts`** — bulk-fetches candidate women from Wikidata (SPARQL, batched with retry/backoff), scores each with the Claude API against inclusion criteria, and writes `.md` files for entries above a threshold (rejects logged to `scripts/rejected.json`). Idempotent — only creates files that don't already exist. Does **not** localize images.
- **`scripts/cache-images.ts`** — for any card with a `wikidataId` and no `image:`, fetches the Wikidata portrait once, saves it to `static/<slug>.<ext>`, and writes `image:` into that card's frontmatter. Detects the real file type from the response's `Content-Type` (Commons can convert on the fly, e.g. a `.tif` source served back as JPEG) rather than trusting the URL. Idempotent — skips cards that already have `image:`.

---

## 5. Wikidata Integration (`src/lib/wikidata.ts`)

- `fetchByWikidataId(id)` — SPARQL query for a single entity: label, description, birth/death date, occupations, and a `P18` (image) claim if present.
- `fetchWomenFromWikidata(limit)` — broader query used only by `scripts/seed-women.ts` (not the running app) to discover candidate entities.
- Image URLs are built as `https://commons.wikimedia.org/wiki/Special:FilePath/<filename>?width=300px` — this is a **redirect** to the actual file on `upload.wikimedia.org`, not a direct link.
- **In-memory cache**: `fetchByWikidataId` results are cached per `wikidataId` for 1 hour (module-level `Map`, cleared via the exported `clearEntityCache()` for test isolation). Without this, every page load re-issued a live SPARQL query per card.

---

## 6. Card Loading (`src/lib/cards.server.ts`)

`loadCards()` runs on every request (`+page.server.ts`):
1. Globs all `src/content/*.md` files (mdsvex, eager).
2. For each card with a `wikidataId`, calls `fetchByWikidataId` — **in parallel** across all cards (`Promise.all`), not sequentially.
3. Merges frontmatter with the Wikidata result via `mergeCardData`: `frontmatter.image` always wins over `wikidata.imageUrl`, so a localized card (see §4/§7) never hits Wikidata for its portrait.

---

## 7. Rendering (`src/routes/+page.svelte`, `src/lib/components/Card.svelte`)

- All cards render in one CSS grid (`repeat(auto-fill, minmax(300px, 1fr))`) — no pagination or virtualization (see `MVP_BUILD_PLAN.md` backlog for when this might need to change).
- Filtering (`type`, `domain`) is entirely client-side over the already-loaded `data.cards` — instant, no extra requests.
- `<img loading="lazy">` is already set on every card portrait.
- `Card.svelte` implements the hover-tilt/foil effect via a Svelte attachment (`@attach holographic`) that reads mouse position into CSS custom properties, and a click/tap-to-reveal overlay for the bio (works without hover on touch devices via `revealed` state + `aria-expanded`).

---

## 8. Known Gaps / Technical Debt

1. **No pagination/virtualization.** Fine at ~32 cards; would need revisiting if the collection grows into the hundreds, since every card still does at least a cache-hit round trip through `loadCards()`.
2. **In-memory cache is per-server-instance and resets on redeploy/cold start.** On Vercel's serverless model this means the "1 hour" TTL is really "1 hour per warm instance" — acceptable for current traffic, but not a durable cache (e.g. Redis/KV) if traffic grows.
3. **A few cards have no usable portrait.** `frances-a-rosamond`, `mary-jane-rathbun`, and `norma-stitz` have no Wikidata `P18` image claim, so they render the placeholder crown icon (`src/lib/assets/crown.svg`) instead of a photo.
4. **`scripts/seed-women.ts` requires `ANTHROPIC_API_KEY`** to be set locally — it is not used at runtime by the deployed app, only for offline content curation.
5. **No CI-enforced image re-check.** If a Wikidata image later disappears/changes, nothing currently re-validates already-localized `static/` assets — they were correct at the time `cache-images.ts` last ran.

---

## 9. Security / Privacy

- No user data is collected, stored, or transmitted — there's no form, no auth, no analytics wired in at the time of writing.
- All outbound requests are to public Wikidata/Wikimedia endpoints with no credentials attached.
- `scripts/seed-women.ts` is the only place an API key (`ANTHROPIC_API_KEY`) is used, and it runs offline/locally, never as part of the deployed app.
