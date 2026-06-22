import { fetchByWikidataId, type WikidataEntity } from './wikidata.js';

export interface CardFrontmatter {
	name: string;
	type: 'mythical' | 'historical';
	era: string;
	domain: string[];
	image?: string;
	wikidataId?: string;
}

export interface Card extends CardFrontmatter {
	slug: string;
	wikidata?: WikidataEntity;
}

/** Pure merge function — exported so it can be unit-tested without the glob. */
export function mergeCardData(
	frontmatter: CardFrontmatter,
	wikidata?: WikidataEntity
): Omit<Card, 'slug'> {
	return {
		...frontmatter,
		// Frontmatter image always wins; fall back to Wikidata imageUrl
		image: frontmatter.image ?? wikidata?.imageUrl ?? undefined,
		wikidata
	};
}

type MdModule = {
	metadata: CardFrontmatter;
};

export async function loadCards(fetchFn: typeof fetch = fetch): Promise<Card[]> {
	const modules = import.meta.glob<MdModule>('../content/*.md', { eager: true });

	const cards: Card[] = [];

	for (const [path, mod] of Object.entries(modules)) {
		const slug = path.replace('../content/', '').replace('.md', '');
		const { metadata } = mod;

		let wikidata: WikidataEntity | undefined;
		if (metadata.wikidataId) {
			try {
				wikidata = (await fetchByWikidataId(metadata.wikidataId, fetchFn)) ?? undefined;
			} catch {
				// Non-fatal: continue without Wikidata enrichment
			}
		}

		cards.push({
			...mergeCardData(metadata, wikidata),
			slug
		});
	}

	return cards;
}
