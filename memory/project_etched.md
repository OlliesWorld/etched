---
name: Etched project overview
description: Core architecture, data flow, and known quirks for the Etched SvelteKit app
type: project
---

Etched is a SvelteKit + Svelte 5 (runes-only) app that showcases cards for remarkable women, fictional heroes, and mythological figures.

**Data flow:**
1. `.md` files in `src/content/` hold frontmatter (name, type, era, domain, image, wikidataId) + markdown body
2. `src/lib/cards.server.ts` — `loadCards(fetch)` globs frontmatter, fetches Wikidata for each card with a `wikidataId`, merges (frontmatter always wins). Returns `Card[]` — no HTML string, no `body` field.
3. `src/routes/+page.server.ts` — calls `loadCards(fetch)` and returns cards as page data
4. `src/routes/+page.svelte` — also globs `../content/*.md` for the Svelte components (md bodies), builds a `contentMap: Record<slug, Component>`, passes both `card` (data) and `Content` (component) to `Card.svelte`
5. `src/lib/components/Card.svelte` — renders card data + `<Content />` (mdsvex Svelte component for the body)

**Key design decisions:**
- No `{@html}` — md body renders as a Svelte component (`<Content />`) via `import.meta.glob`
- Holographic effect uses `{@attach holographic}` (Svelte 5 attachment API) — no `bind:this`, no `$state` ref
- CSS-only animation: `@property --mouse-x/--mouse-y` + `perspective` + `rotateX/Y` + `hsl` gradient shifts
- `mergeCardData()` is pure/exported for unit testing without Vite glob

**Known quirk:**
- mdsvex 0.12.x emits `context="module"` (deprecated in Svelte 5 → should be `module`). This is a mdsvex issue, not ours — shows as a Vite warning but doesn't break anything.

**Why:** SvelteKit + Svelte 5 (runes), mdsvex, Wikidata SPARQL, Vercel hosting.
**How to apply:** When adding new cards or features, follow the same content-as-component pattern. Don't reintroduce `{@html}` for md bodies.
