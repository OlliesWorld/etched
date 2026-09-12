# Etched — MVP Build Plan

**Date:** September 12, 2026
**Version:** 1.0

---

## Overview

Etched is a single-page, browsable card gallery of mythical figures and remarkable historical women, built with SvelteKit + mdsvex + live Wikidata enrichment. No auth, no database, no admin UI — content is markdown files in the repo, optionally enriched at request time from Wikidata.

**Core value prop:** make biographical facts collectible and fun to browse, with content that stays accurate because it's sourced from Wikidata rather than hand-copied.

---

## Status: MVP is built and shipped

### Shipped
- **Card gallery** — ~32 cards (30 historical women + Athena + Wonder Woman) rendered in a responsive grid from `src/content/*.md`.
- **Type + domain filtering** — client-side, instant, combinable (segmented control for type, collapsible pill row for domain).
- **Holographic card interaction** — mouse-tracked 3D tilt, spotlight, and rainbow foil hover effects; tap-to-reveal on touch devices.
- **Wikidata enrichment** — description, birth/death year, occupations, and (when no local image exists) a portrait, fetched live per card via SPARQL.
- **Content tooling** — `scripts/seed-women.ts` bulk-generates and Claude-scores new candidate cards from Wikidata; `scripts/cache-images.ts` localizes portraits into `static/` and bakes an `image:` path into frontmatter.
- **Image localization** — 28 of 30 Wikidata-sourced cards now serve a locally-cached portrait instead of hotlinking `commons.wikimedia.org` on every request.
- **Perf fix: parallel + cached Wikidata lookups** — `loadCards()` used to fetch each card's Wikidata data sequentially with no caching, meaning every page load serialized ~30 live SPARQL round trips. This is now parallelized (`Promise.all`) and cached in memory (1h TTL).
- **Lazy image loading** — `loading="lazy"` on every card portrait.
- **Test coverage** — Vitest unit tests for `wikidata.ts` (SPARQL response normalization, caching) and `cards.server.ts` (frontmatter/Wikidata merge logic); Playwright e2e scaffold in place.

### Known gaps (carried from `TECH_SPEC.md` §8)
- No pagination/virtualization — fine at ~32 cards, would need attention if the collection grows substantially.
- In-memory Wikidata cache resets per cold start on Vercel's serverless model — not a durable cache.
- 3 cards (`frances-a-rosamond`, `mary-jane-rathbun`, `norma-stitz`) have no Wikidata portrait and show a placeholder icon.
- No CI check that re-validates previously localized `static/` images stay in sync with Wikidata if the source image changes.

---

## Backlog / Candidate Next Priorities

Unlike `PRD.md`'s pillars, there is no user-set sequence for these yet — they're listed here as real, identified gaps for the site owner to prioritize, not a committed roadmap.

### A: Grow the collection
- Run `scripts/seed-women.ts` with a higher `limit`/lower `--threshold` periodically to surface new candidates for manual review (`scripts/rejected.json` holds what was filtered out, for override).
- Follow every content addition with `scripts/cache-images.ts` so new cards don't reintroduce the hotlinking perf issue.
- Consider hand-curating a source for images on the 3 cards with no Wikidata `P18` claim.

### B: Durable caching
- If traffic grows enough that per-instance in-memory caching (`TECH_SPEC.md` §8.2) becomes visibly stale/inconsistent across serverless instances, move the Wikidata cache to a shared store (e.g. Vercel KV/Redis) or bake all Wikidata fields into frontmatter at content-authoring time (like images already are) so the running app never depends on Wikidata's uptime at all.

### C: Scale the browsing UI
- If the collection grows past what one ungated grid comfortably shows, add pagination, infinite scroll, or a search box — not needed at current scale (`DESIGN_SPEC.md` "What's Deliberately Not Being Designed Right Now").
- Consider extracting the inline filter controls in `+page.svelte` into reusable components if a second page or additional filter axis is ever added.

### D: Broaden content beyond "notable women"
- `seed-women.ts` is currently scoped to Wikidata's "notable women" query (`P21` = female). If the collection's scope broadens (more mythical figures, other underrepresented groups, etc.), either generalize the seed script's query or add a parallel one.

---

## Architecture Notes

Single SvelteKit app, no backend service, no database — see `TECH_SPEC.md` for the full architecture, data model, and Wikidata integration details.
