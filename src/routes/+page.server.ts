import type { PageServerLoad } from './$types.js';
import { loadCards } from '$lib/cards.server.js';

export const load: PageServerLoad = async ({ fetch }) => {
	const cards = await loadCards(fetch);
	return { cards };
};
