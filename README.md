# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
pnpm dlx sv@0.15.1 create --template minimal --types ts --add prettier vitest="usages:unit,component" playwright mdsvex mcp="ide:claude-code+setup:local" --install pnpm etched
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
# etched

## Content & images

Cards live as markdown files in `src/content/*.md` with YAML frontmatter (`name`, `type`, `era`, `domain`, `wikidataId`, and optionally `image`). At request time, `loadCards()` (`src/lib/cards.server.ts`) enriches each card with data from Wikidata (description, birth/death year, occupations) via `src/lib/wikidata.ts`, which caches responses in memory for an hour.

If a card's frontmatter has no `image:` field, its portrait falls back to a live hotlink to `commons.wikimedia.org/wiki/Special:FilePath/...` (a redirect to `upload.wikimedia.org`) on every page load — slow, and dependent on Wikimedia's uptime. Prefer baking in a local image instead:

```sh
npx tsx scripts/cache-images.ts
```

This downloads each card's Wikidata portrait once, saves it to `static/<slug>.<ext>`, and writes `image: '/<slug>.<ext>'` into that card's frontmatter. It only touches cards that have a `wikidataId` and no existing `image:`, so it's safe to re-run after adding new cards (e.g. via `scripts/seed-women.ts`, which creates content files but does not localize images itself).
