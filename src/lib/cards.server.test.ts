import { describe, it, expect } from 'vitest';
import { mergeCardData } from './cards.server.js';
import type { CardFrontmatter } from './cards.server.js';
import type { WikidataEntity } from './wikidata.js';

const frontmatter: CardFrontmatter = {
	name: 'Wonder Woman',
	type: 'mythical',
	era: 'modern',
	domain: ['justice', 'strength'],
	image: '/images/wonder-woman.jpg',
	wikidataId: 'Q189048'
};

const wikidata: WikidataEntity = {
	wikidataId: 'Q189048',
	name: 'Wonder Woman',
	description: 'DC Comics superhero',
	imageUrl: 'https://upload.wikimedia.org/wonder-woman.jpg',
	occupation: ['superhero']
};

describe('mergeCardData', () => {
	it('frontmatter image overrides Wikidata wikimediaImage', () => {
		const result = mergeCardData(frontmatter, wikidata);
		expect(result.image).toBe('/images/wonder-woman.jpg');
	});

	it('falls back to Wikidata imageUrl when frontmatter has no image', () => {
		const noImage: CardFrontmatter = { ...frontmatter, image: undefined };
		const result = mergeCardData(noImage, wikidata);
		expect(result.image).toBe('https://upload.wikimedia.org/wonder-woman.jpg');
	});

	it('preserves all frontmatter fields', () => {
		const result = mergeCardData(frontmatter, wikidata);
		expect(result.name).toBe('Wonder Woman');
		expect(result.type).toBe('mythical');
		expect(result.era).toBe('modern');
		expect(result.domain).toEqual(['justice', 'strength']);
		expect(result.wikidataId).toBe('Q189048');
	});

	it('attaches wikidata when provided', () => {
		const result = mergeCardData(frontmatter, wikidata);
		expect(result.wikidata).toBe(wikidata);
	});

	it('works without any wikidata — image stays from frontmatter', () => {
		const result = mergeCardData(frontmatter);
		expect(result.wikidata).toBeUndefined();
		expect(result.image).toBe('/images/wonder-woman.jpg');
	});

	it('image is undefined when neither frontmatter nor wikidata has one', () => {
		const noImage: CardFrontmatter = { ...frontmatter, image: undefined };
		const noWikiImage: WikidataEntity = { ...wikidata, imageUrl: null };
		const result = mergeCardData(noImage, noWikiImage);
		expect(result.image).toBeUndefined();
	});
});
