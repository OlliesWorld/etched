# Etched — Design Spec

**Date:** September 12, 2026
**Version:** 1.0

---

## Product Overview

Etched is a single-page, dark-mode, trading-card-style gallery of mythical figures and remarkable historical women. The whole experience is one page: a header, two filter controls, and a responsive grid of interactive cards.

**Target experience:** feels like flipping through a physical holographic trading card set — tactile, a little playful, rewarding hover/tap exploration — not a dry reference table.

---

## Design Direction

**Aesthetic:** Dark, moody, holographic — deep space-purple/indigo gradients, foil-like rainbow highlights on hover, soft glow rather than hard edges. This is the opposite emphasis from a light, utilitarian productivity tool: Etched is meant to be browsed for fun, not used to get a task done quickly.

**Actual color values in use** (no CSS-variable theme system yet — colors are hardcoded per component):

| Use | Value | Where |
|-----|-------|-------|
| Page background | dark indigo/space gradient | `+layout.svelte` / global styles |
| Card surface | `linear-gradient(145deg, #16132a 0%, #0e0c1e 55%, #12102a 100%)` | `Card.svelte` `.card` |
| Card text | `#e8e8f0` | `Card.svelte` |
| Title gradient | `linear-gradient(135deg, #c4a0ff, #7ec8f5, #6deda0)` (purple → blue → mint) | `+page.svelte` `h1` |
| Era tag | bg `#0f2e45`, text `#7ec8f5` | `Card.svelte` `.era` |
| "Historical" type accent | bg `rgba(236,179,89,.2)`, text `#ffe0ac` (warm gold) | `domain-colors.ts` `TYPE_PALETTES.historical` |
| "Mythical" type accent | bg `rgba(170,118,240,.2)`, text `#e6cbff` (violet) | `domain-colors.ts` `TYPE_PALETTES.mythical` |
| Domain tags | one of 12 deterministic palettes, hashed from the domain string | `domain-colors.ts` `DOMAIN_PALETTES` / `getDomainPalette` |
| Accent / links | `#c084fc` (purple) | `Card.svelte` `.learn-more`, `.reveal-name` |

There is no light-mode variant and no dark/light toggle — dark is the only theme.

**Typography:** System default stack (no custom font loaded). Title uses a large, bold, gradient-clipped treatment (`clamp(2.5rem, 6vw, 4rem)`, `font-weight: 800`, `letter-spacing: -0.03em`).

**Visual principles:**
- **Physicality first.** The card tilts in 3D toward the cursor (`perspective(700px) rotateY(...) rotateX(...)`), has a moving radial "spotlight" and a rainbow foil sweep on `::before`/`::after`, and a drop shadow that shifts with mouse position — deliberately reads as a real holographic card, not a flat UI element.
- **Front is image + identity only.** No text overlay on the portrait itself — name and tags live in an opaque footer bar below the image so the artwork stays clean.
- **Reveal, don't clutter.** Bio/description/"Learn more" link live in a slide-up overlay (`.reveal`) that appears on hover (desktop, `@media (hover: hover)`) or tap (`revealed` state on all devices) — the default resting state is uncluttered.
- **Rounded, soft, glowing** — `border-radius: 1rem` cards, `backdrop-filter: blur()` on tag/footer surfaces, glow-style shadows rather than hard borders.
- **Mobile still works**, but the design center of gravity is a desktop/hover-first "collectible browsing" experience — the mouse-driven tilt effect is the headline interaction, and it degrades gracefully (no hover) rather than being redesigned for touch.

---

## Existing Component Vocabulary

Very small — this is not a component-library-driven app:
- **`Card.svelte`** — the only real UI component. Encapsulates the tilt/foil/reveal behavior via a reusable `holographic` Svelte attachment.
- **Filter controls in `+page.svelte`** — a segmented control (type) and a pill-button row (domain, collapsible via a "More ▾ / Less ▲" toggle) are hand-built inline, not extracted into `src/lib/components/`. If a second page or a third filter axis is ever added, these should graduate into their own components rather than being redefined per page.
- **`domain-colors.ts`** — the one shared "design token" module: deterministic color assignment so any domain string (present or future) gets a stable, distinct color without manual palette maintenance.

---

## Core Screens (as implemented)

There is exactly one screen: the root route (`/`, `src/routes/+page.svelte`).

### Header
Site title ("Etched", gradient text) and tagline ("because they were never going to be forgotten.") — centered, no navigation.

### Filters
Two stacked filter groups, both centered:
- **Type** — segmented control (`all` / `historical` / `mythical`), animated sliding indicator behind the active option, indicator color matches the type's accent palette.
- **Domain** — pill buttons for every domain present across all loaded cards (deduplicated, alphabetized), plus an `All` pill. Collapses to one row by default with a bottom fade-mask hinting more exist; "More ▾" expands to show all, "Less ▲" collapses again.

Both filters combine with AND logic and re-filter the grid instantly (no loading state needed — filtering is client-side over already-loaded data).

### Card grid
Responsive CSS grid, `minmax(300px, 1fr)` columns, all matching cards rendered at once (see `TECH_SPEC.md` §7 for why this is fine at current scale). Each card:
- **Front:** portrait (or a faint crown icon placeholder if no image exists) + footer with name and tag pills (era + all domains).
- **Reveal (hover/tap):** name repeated in small-caps purple, italic Wikidata description (when available), the markdown body content, and a "Learn more →" link to the card's Wikipedia page (only shown when `wikidataId` is present).

---

## What's Deliberately Not Being Designed Right Now

- No light mode / theme switcher — dark holographic is the only identity of the product, not one of several themes.
- No dedicated mobile-redesigned interaction for the tilt effect — it simply doesn't fire without hover; no touch-specific replacement (e.g. gyroscope tilt) is planned.
- No search — filtering by type/domain is considered sufficient at current collection size; a search box is not in scope until the collection grows enough to need one.
- No card detail page / permalink per card — the reveal overlay is the only "detail view"; there is no `/cards/[slug]` route.
- No shared component library beyond what's listed above — one-off screens aren't expected soon enough to justify building one preemptively.
