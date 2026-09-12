import type { PageServerLoad } from './$types.js';
import { loadCards } from '$lib/cards.server.js';

// Card content only changes when the repo is edited and redeployed, so
// render this once at build time instead of hitting Wikidata on every
// request — the previous per-request load could take 10+ seconds on a
// cold serverless instance.
export const prerender = true;

export const load: PageServerLoad = async ({ fetch }) => {
	const cards = await loadCards(fetch);
	return { cards };
};
