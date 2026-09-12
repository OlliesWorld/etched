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

	const entries = Object.entries(modules).map(([path, mod]) => ({
		slug: path.replace('../content/', '').replace('.md', ''),
		metadata: mod.metadata
	}));

	// Cards that already ship a local `image:` don't need Wikidata at all
	// beyond the description shown in the reveal panel, but we still only
	// need one lookup per card — do them all in parallel instead of one
	// request at a time, which used to serialize ~30 live SPARQL calls
	// behind a single page load.
	const cards = await Promise.all(
		entries.map(async ({ slug, metadata }) => {
			let wikidata: WikidataEntity | undefined;
			if (metadata.wikidataId) {
				try {
					wikidata = (await fetchByWikidataId(metadata.wikidataId, fetchFn)) ?? undefined;
				} catch {
					// Non-fatal: continue without Wikidata enrichment
				}
			}

			return {
				...mergeCardData(metadata, wikidata),
				slug
			};
		})
	);

	return cards;
}
