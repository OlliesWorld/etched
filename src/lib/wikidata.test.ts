import { describe, it, expect, vi } from 'vitest';
import {
	extractYear,
	normalizeWomenResponse,
	normalizeEntityResponse,
	fetchWomenFromWikidata,
	fetchByWikidataId
} from './wikidata.js';

// ─── Mock SPARQL data ─────────────────────────────────────────────────────────

// Simulates a multi-entity women query response. Marie Curie has two
// occupation rows; Athena has no dates or image.
const mockWomenResponse = {
	results: {
		bindings: [
			{
				item: { value: 'http://www.wikidata.org/entity/Q7186' },
				itemLabel: { value: 'Marie Curie' },
				itemDescription: { value: 'Polish-French physicist and chemist' },
				birthDate: { value: '1867-11-07T00:00:00Z' },
				deathDate: { value: '1934-07-04T00:00:00Z' },
				image: {
					value:
						'http://commons.wikimedia.org/wiki/Special:FilePath/Marie%20Curie%20c1920.jpg'
				},
				occupationLabel: { value: 'physicist' }
			},
			{
				item: { value: 'http://www.wikidata.org/entity/Q7186' },
				itemLabel: { value: 'Marie Curie' },
				itemDescription: { value: 'Polish-French physicist and chemist' },
				birthDate: { value: '1867-11-07T00:00:00Z' },
				deathDate: { value: '1934-07-04T00:00:00Z' },
				image: {
					value:
						'http://commons.wikimedia.org/wiki/Special:FilePath/Marie%20Curie%20c1920.jpg'
				},
				occupationLabel: { value: 'chemist' }
			},
			{
				item: { value: 'http://www.wikidata.org/entity/Q45867' },
				itemLabel: { value: 'Athena' },
				itemDescription: { value: 'ancient Greek goddess of wisdom' },
				occupationLabel: { value: 'deity' }
			}
		]
	}
};

// Simulates a single-entity by-ID response (multiple rows for occupations)
const mockEntityResponse = {
	results: {
		bindings: [
			{
				itemLabel: { value: 'Marie Curie' },
				itemDescription: { value: 'Polish-French physicist and chemist' },
				birthDate: { value: '1867-11-07T00:00:00Z' },
				deathDate: { value: '1934-07-04T00:00:00Z' },
				image: {
					value:
						'http://commons.wikimedia.org/wiki/Special:FilePath/Marie%20Curie%20c1920.jpg'
				},
				occupationLabel: { value: 'physicist' }
			},
			{
				itemLabel: { value: 'Marie Curie' },
				itemDescription: { value: 'Polish-French physicist and chemist' },
				occupationLabel: { value: 'chemist' }
			}
		]
	}
};

// ─── extractYear ──────────────────────────────────────────────────────────────

describe('extractYear', () => {
	it('extracts year from a full ISO 8601 date', () => {
		expect(extractYear('1867-11-07T00:00:00Z')).toBe('1867');
	});

	it('handles a leading + sign (Wikidata CE dates)', () => {
		expect(extractYear('+1867-11-07T00:00:00Z')).toBe('1867');
	});

	it('handles a leading - sign (BCE dates)', () => {
		expect(extractYear('-0427-00-00T00:00:00Z')).toBe('-427');
	});

	it('handles year-only precision (month/day zeros)', () => {
		expect(extractYear('1934-00-00T00:00:00Z')).toBe('1934');
	});

	it('returns undefined for undefined input', () => {
		expect(extractYear(undefined)).toBeUndefined();
	});

	it('returns undefined for an unparseable string', () => {
		expect(extractYear('not-a-date')).toBeUndefined();
	});
});

// ─── normalizeWomenResponse ───────────────────────────────────────────────────

describe('normalizeWomenResponse', () => {
	it('returns one entity per unique item URI', () => {
		const result = normalizeWomenResponse(mockWomenResponse);
		expect(result).toHaveLength(2);
	});

	it('maps fields to the expected shape', () => {
		const [curie] = normalizeWomenResponse(mockWomenResponse);
		expect(curie.wikidataId).toBe('Q7186');
		expect(curie.name).toBe('Marie Curie');
		expect(curie.description).toBe('Polish-French physicist and chemist');
		expect(curie.born).toBe('1867');
		expect(curie.died).toBe('1934');
		expect(curie.imageUrl).toBe(
			'https://commons.wikimedia.org/wiki/Special:FilePath/Marie%20Curie%20c1920.jpg?width=300px'
		);
	});

	it('collects occupations from multiple rows for the same entity', () => {
		const [curie] = normalizeWomenResponse(mockWomenResponse);
		expect(curie.occupation).toEqual(['physicist', 'chemist']);
	});

	it('deduplicates repeated occupation rows', () => {
		const dupes = {
			results: {
				bindings: [
					{
						item: { value: 'http://www.wikidata.org/entity/Q1' },
						itemLabel: { value: 'Ada Lovelace' },
						itemDescription: { value: 'English mathematician' },
						occupationLabel: { value: 'mathematician' }
					},
					{
						item: { value: 'http://www.wikidata.org/entity/Q1' },
						itemLabel: { value: 'Ada Lovelace' },
						itemDescription: { value: 'English mathematician' },
						occupationLabel: { value: 'mathematician' }
					}
				]
			}
		};
		const [entity] = normalizeWomenResponse(dupes);
		expect(entity.occupation).toEqual(['mathematician']);
	});

	it('handles entities with no dates or image', () => {
		const [, athena] = normalizeWomenResponse(mockWomenResponse);
		expect(athena.born).toBeUndefined();
		expect(athena.died).toBeUndefined();
		expect(athena.imageUrl).toBeNull();
		expect(athena.occupation).toEqual(['deity']);
	});

	it('returns an empty array for an empty bindings list', () => {
		expect(normalizeWomenResponse({ results: { bindings: [] } })).toEqual([]);
	});

	it('skips entities whose label is a fallback URI (no English label)', () => {
		const noLabel = {
			results: {
				bindings: [
					{
						item: { value: 'http://www.wikidata.org/entity/Q999' },
						itemLabel: { value: 'http://www.wikidata.org/entity/Q999' },
						itemDescription: { value: 'some description' }
					}
				]
			}
		};
		expect(normalizeWomenResponse(noLabel)).toEqual([]);
	});

	it('skips occupation values that are fallback URIs', () => {
		const uriOcc = {
			results: {
				bindings: [
					{
						item: { value: 'http://www.wikidata.org/entity/Q2' },
						itemLabel: { value: 'Hypatia' },
						itemDescription: { value: 'Greek mathematician' },
						occupationLabel: { value: 'http://www.wikidata.org/entity/Q9999' }
					}
				]
			}
		};
		const [entity] = normalizeWomenResponse(uriOcc);
		expect(entity.occupation).toEqual([]);
	});
});

// ─── normalizeEntityResponse ──────────────────────────────────────────────────

describe('normalizeEntityResponse', () => {
	it('maps fields to the expected shape', () => {
		const result = normalizeEntityResponse(mockEntityResponse, 'Q7186');
		expect(result).not.toBeNull();
		expect(result!.wikidataId).toBe('Q7186');
		expect(result!.name).toBe('Marie Curie');
		expect(result!.description).toBe('Polish-French physicist and chemist');
		expect(result!.born).toBe('1867');
		expect(result!.died).toBe('1934');
		expect(result!.imageUrl).toBe(
			'https://commons.wikimedia.org/wiki/Special:FilePath/Marie%20Curie%20c1920.jpg?width=300px'
		);
		expect(result!.occupation).toEqual(['physicist', 'chemist']);
	});

	it('returns null for an empty bindings list', () => {
		expect(normalizeEntityResponse({ results: { bindings: [] } }, 'Q999')).toBeNull();
	});

	it('returns null when the label is a fallback URI', () => {
		const noLabel = {
			results: {
				bindings: [
					{
						itemLabel: { value: 'http://www.wikidata.org/entity/Q123' },
						itemDescription: { value: 'some entity' }
					}
				]
			}
		};
		expect(normalizeEntityResponse(noLabel, 'Q123')).toBeNull();
	});

	it('handles missing optional fields gracefully', () => {
		const minimal = {
			results: {
				bindings: [{ itemLabel: { value: 'Athena' }, itemDescription: { value: 'Greek goddess' } }]
			}
		};
		const result = normalizeEntityResponse(minimal, 'Q45867');
		expect(result).not.toBeNull();
		expect(result!.born).toBeUndefined();
		expect(result!.died).toBeUndefined();
		expect(result!.imageUrl).toBeNull();
		expect(result!.occupation).toEqual([]);
	});

	it('deduplicates occupations', () => {
		const dupes = {
			results: {
				bindings: [
					{ itemLabel: { value: 'X' }, itemDescription: { value: 'Y' }, occupationLabel: { value: 'scientist' } },
					{ itemLabel: { value: 'X' }, itemDescription: { value: 'Y' }, occupationLabel: { value: 'scientist' } }
				]
			}
		};
		const result = normalizeEntityResponse(dupes, 'Q1');
		expect(result!.occupation).toEqual(['scientist']);
	});
});

// ─── fetchWomenFromWikidata ───────────────────────────────────────────────────

describe('fetchWomenFromWikidata', () => {
	it('calls the Wikidata SPARQL endpoint with correct headers', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockWomenResponse
		});

		await fetchWomenFromWikidata(20, mockFetch as unknown as typeof fetch);

		expect(mockFetch).toHaveBeenCalledOnce();
		const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
		expect(url).toContain('wikidata.org/sparql');
		expect(url).toContain('format=json');
		expect((options.headers as Record<string, string>)['Accept']).toBe(
			'application/sparql-results+json'
		);
	});

	it('encodes the gender and human filters in the query', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockWomenResponse
		});

		await fetchWomenFromWikidata(20, mockFetch as unknown as typeof fetch);

		const [url] = mockFetch.mock.calls[0] as [string];
		const decoded = decodeURIComponent(url);
		expect(decoded).toContain('Q6581072'); // female gender
		expect(decoded).toContain('Q5');       // instance of human
	});

	it('encodes the limit into the query', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockWomenResponse
		});

		await fetchWomenFromWikidata(50, mockFetch as unknown as typeof fetch);

		const [url] = mockFetch.mock.calls[0] as [string];
		expect(decodeURIComponent(url)).toContain('LIMIT 50');
	});

	it('returns normalized entities', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockWomenResponse
		});

		const result = await fetchWomenFromWikidata(20, mockFetch as unknown as typeof fetch);
		expect(result).toHaveLength(2);
		expect(result[0].name).toBe('Marie Curie');
	});

	it('throws when the response is not ok', async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: false, statusText: 'Service Unavailable' });
		await expect(
			fetchWomenFromWikidata(20, mockFetch as unknown as typeof fetch)
		).rejects.toThrow('Wikidata SPARQL request failed');
	});
});

// ─── fetchByWikidataId ────────────────────────────────────────────────────────

describe('fetchByWikidataId', () => {
	it('includes the Q-number in the SPARQL query URL', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockEntityResponse
		});

		await fetchByWikidataId('Q7186', mockFetch as unknown as typeof fetch);

		const [url] = mockFetch.mock.calls[0] as [string];
		expect(decodeURIComponent(url)).toContain('Q7186');
	});

	it('returns a normalized entity on success', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockEntityResponse
		});

		const result = await fetchByWikidataId('Q7186', mockFetch as unknown as typeof fetch);
		expect(result).not.toBeNull();
		expect(result!.name).toBe('Marie Curie');
		expect(result!.occupation).toEqual(['physicist', 'chemist']);
	});

	it('returns null when the entity has no English label', async () => {
		const noLabel = {
			results: {
				bindings: [
					{
						itemLabel: { value: 'http://www.wikidata.org/entity/Q999' },
						itemDescription: { value: 'something' }
					}
				]
			}
		};
		const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => noLabel });
		const result = await fetchByWikidataId('Q999', mockFetch as unknown as typeof fetch);
		expect(result).toBeNull();
	});

	it('throws when the response is not ok', async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: false, statusText: 'Too Many Requests' });
		await expect(
			fetchByWikidataId('Q7186', mockFetch as unknown as typeof fetch)
		).rejects.toThrow('Wikidata SPARQL request failed');
	});
});
