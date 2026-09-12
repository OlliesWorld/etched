# Etched — Product Requirements Document

**Date:** September 12, 2026
**Version:** 1.0

---

## 1. Product Vision

Etched is a browsable card collection of remarkable people — mythical figures and real historical women — presented as tactile, hover-reactive trading cards. Each card shows a portrait and name up front; flipping it open reveals a Wikidata-sourced description, era, and domain tags.

**Core value proposition:** turn otherwise-dry biographical facts into something collectible and fun to browse — "because they were never going to be forgotten."

---

## 2. Users & Roles

There is no authentication and no user accounts. The entire product is a single public, read-only page. There is one implicit "role": **visitor**, who can browse, filter, and flip cards but not create, edit, or save anything through the UI.

Content (which cards exist) is authored by the site owner directly in the repo — see §4 and `TECH_SPEC.md` §4 for how.

---

## 3. Core Experience

### Pillar A: Browse & discover
A single grid of cards, each showing a portrait, name, era, and domain tags. Cards react to mouse position (holographic tilt/foil effect) and flip open on hover/tap to reveal a short bio pulled from Wikidata plus a hand-written flavor blurb.

### Pillar B: Filter
Two filter axes: **type** (`mythical` vs `historical`, segmented control) and **domain** (wisdom, science, music, politics, etc. — pill buttons, collapsible). Filters combine (AND) and update the grid instantly, client-side.

### Pillar C: Accurate, sourced content
Historical cards are grounded in real Wikidata entities (`wikidataId` in frontmatter) — birth/death year, occupations, and description are fetched live from Wikidata rather than hand-typed, so they stay accurate to the source. Mythical cards (Athena, Wonder Woman) have no Wikidata backing and rely entirely on hand-written frontmatter/body content.

### Pillar D: Fast, resilient loading
The card grid must load quickly and not depend on the availability or latency of external services (Wikidata, Wikimedia Commons) at request time — see `TECH_SPEC.md` §6 for the caching/localization work already done here, since this was a real bug (see project history: page load was slow because every card triggered a live, uncached Wikidata SPARQL request, and most portraits hotlinked Wikimedia Commons on every request).

---

## 4. Content Model

Each card is one markdown file in `src/content/*.md` with YAML frontmatter:

```yaml
---
name: "Ada Lovelace"
type: historical        # historical | mythical
era: modern              # ancient | medieval | early-modern | modern | contemporary | unknown
domain: [science, writer, math, computers]
wikidataId: Q7259        # optional — omit for cards with no Wikidata entity (e.g. mythical figures)
image: '/ada-lovelace.png'  # optional — local static path; falls back to a live Wikidata portrait if omitted
---

Free-text body (rendered via mdsvex) — a short flavor blurb shown alongside the Wikidata description.
```

Adding a new card means adding one `.md` file — no database, no admin UI, no deploy-time build step beyond the normal SvelteKit build. See `scripts/seed-women.ts` for a semi-automated way to bulk-generate candidate cards from Wikidata (filtered/scored by Claude) and `scripts/cache-images.ts` for localizing portraits after content is added.

---

## 5. Explicitly Out of Scope

- **User accounts, auth, or personalization** — this is a static, public, read-only browsing experience. No favorites, no saved filters, no login.
- **A CMS or admin UI for authoring cards** — content is authored by editing markdown files directly in the repo.
- **User-submitted cards** — all content is curated by the site owner (manually or via `scripts/seed-women.ts` + manual review).
- **Pagination/infinite scroll** — the full set (currently ~32 cards) renders in one grid; revisit only if the collection grows large enough that this becomes a real cost (see `TECH_SPEC.md` §8).

---

## 6. Success Signals (directional, not committed metrics)

- The page loads fast and feels smooth to browse/filter, with no visible stutter from image loading or external API latency.
- The collection grows over time (via `seed-women.ts` + manual curation) without needing engineering work for each new card beyond running the existing scripts.
- Visitors flip and explore multiple cards per visit rather than bouncing after the first screen — a proxy for whether the hover/flip interaction and filtering actually invite exploration.
