const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const COMMONS_FILE_PATH_ENDPOINT = 'https://commons.wikimedia.org/wiki/Special:FilePath';

export interface WikidataEntity {
	wikidataId: string;
	name: string;
	description: string;
	born?: string;
	died?: string;
	occupation: string[];
	imageUrl: string | null;
}

// ─── SPARQL query builders ────────────────────────────────────────────────────

function buildWomenQuery(limit: number): string {
	return `SELECT DISTINCT ?item ?itemLabel ?itemDescription ?birthDate ?deathDate ?image ?occupationLabel WHERE {
  ?item wdt:P31 wd:Q5 ;
        wdt:P21 wd:Q6581072 .
  OPTIONAL { ?item wdt:P569 ?birthDate . }
  OPTIONAL { ?item wdt:P570 ?deathDate . }
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL {
    ?item wdt:P106 ?occupation .
    ?occupation rdfs:label ?occupationLabel .
    FILTER(LANG(?occupationLabel) = "en")
  }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en" .
  }
  FILTER(LANG(?itemLabel) = "en")
  FILTER(LANG(?itemDescription) = "en")
} LIMIT ${limit}`;
}

function buildEntityQuery(wikidataId: string): string {
	return `SELECT ?itemLabel ?itemDescription ?birthDate ?deathDate ?image ?occupationLabel WHERE {
  BIND(wd:${wikidataId} AS ?item)
  OPTIONAL { ?item wdt:P569 ?birthDate . }
  OPTIONAL { ?item wdt:P570 ?deathDate . }
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL {
    ?item wdt:P106 ?occupation .
    ?occupation rdfs:label ?occupationLabel .
    FILTER(LANG(?occupationLabel) = "en")
  }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en" .
  }
} LIMIT 10`;
}

// ─── Normalize helpers ────────────────────────────────────────────────────────

/**
 * Extract the four-digit (or signed) year from a Wikidata ISO 8601 date value.
 * "+1867-11-07T00:00:00Z" → "1867"   "-0427-00-00T00:00:00Z" → "-427"
 * Exported for unit testing.
 */
export function extractYear(isoDate: string | undefined): string | undefined {
	if (!isoDate) return undefined;
	const match = isoDate.match(/^([+-]?\d+)-/);
	if (!match) return undefined;
	const n = parseInt(match[1], 10);
	if (isNaN(n)) return undefined;
	return String(n);
}

function isLiteralLabel(value: string | undefined): boolean {
	// The Wikidata label service falls back to the entity URI when no label exists
	return !!value && !value.startsWith('http');
}

function collectOccupations(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	bindings: any[],
	key = 'occupationLabel'
): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const b of bindings) {
		const occ: string | undefined = b[key]?.value;
		if (occ && isLiteralLabel(occ) && !seen.has(occ)) {
			seen.add(occ);
			result.push(occ);
		}
	}
	return result;
}

function buildCommonsImageUrl(filename: string | undefined): string | null {
	if (!filename) return null;

	// P18 may already be a Commons Special:FilePath URI or a raw filename.
	const rawName = filename.includes('/Special:FilePath/')
		? decodeURIComponent(filename.split('/Special:FilePath/').pop() ?? '')
		: filename;

	if (!rawName) return null;
	return `${COMMONS_FILE_PATH_ENDPOINT}/${encodeURIComponent(rawName)}?width=300px`;
}

// ─── Public normalizers (exported for unit testing) ──────────────────────────

/**
 * Normalise a SPARQL response from the "notable women" query.
 * Multiple rows per entity are expected (one per occupation); they are grouped
 * by the `?item` URI and deduplicated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeWomenResponse(data: any): WikidataEntity[] {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const bindings: any[] = data?.results?.bindings ?? [];
	const map = new Map<string, WikidataEntity>();

	for (const b of bindings) {
		const itemUrl: string = b.item?.value ?? '';
		const id = itemUrl.split('/').pop() ?? '';
		if (!id.startsWith('Q')) continue;

		if (!map.has(id)) {
			const name: string = b.itemLabel?.value ?? '';
			const description: string = b.itemDescription?.value ?? '';
			if (!isLiteralLabel(name)) continue;

			map.set(id, {
				wikidataId: id,
				name,
				description,
				born: extractYear(b.birthDate?.value),
				died: extractYear(b.deathDate?.value),
				occupation: [],
				imageUrl: buildCommonsImageUrl(b.image?.value)
			});
		}

		const entity = map.get(id);
		if (!entity) continue;

		const occ: string | undefined = b.occupationLabel?.value;
		if (occ && isLiteralLabel(occ) && !entity.occupation.includes(occ)) {
			entity.occupation.push(occ);
		}
	}

	// Drop any entity that ended up with no usable name or description
	return Array.from(map.values()).filter((e) => e.name && e.description);
}

/**
 * Normalise a SPARQL response for a single entity fetched by Wikidata ID.
 * Returns null when the response is empty or the entity has no English label.
 */
export function normalizeEntityResponse(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	data: any,
	wikidataId: string
): WikidataEntity | null {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const bindings: any[] = data?.results?.bindings ?? [];
	if (bindings.length === 0) return null;

	const first = bindings[0];
	const name: string = first.itemLabel?.value ?? '';
	if (!isLiteralLabel(name)) return null;

	return {
		wikidataId,
		name,
		description: first.itemDescription?.value ?? '',
		born: extractYear(first.birthDate?.value),
		died: extractYear(first.deathDate?.value),
		occupation: collectOccupations(bindings),
		imageUrl: buildCommonsImageUrl(first.image?.value)
	};
}

// ─── HTTP layer ───────────────────────────────────────────────────────────────

async function sparqlFetch(query: string, fetchFn: typeof fetch): Promise<unknown> {
	const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
	const response = await fetchFn(url, {
		headers: {
			Accept: 'application/sparql-results+json',
			'User-Agent': 'Etched/1.0 (SvelteKit demo app)',
			'Referer': 'https://www.wikidata.org/'
		}
	});
	if (!response.ok) {
		throw new Error(`Wikidata SPARQL request failed: ${response.statusText}`);
	}
	return response.json();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch notable women from Wikidata — filtered by gender (Q6581072 = female),
 * instance of human (Q5), and requiring both an English label and description.
 */
export async function fetchWomenFromWikidata(
	limit = 20,
	fetchFn: typeof fetch = fetch
): Promise<WikidataEntity[]> {
	const data = await sparqlFetch(buildWomenQuery(limit), fetchFn);
	return normalizeWomenResponse(data);
}

/**
 * Fetch a single Wikidata entity by its Q-number.
 * Returns null when the entity has no English label or the response is empty.
 */
export async function fetchByWikidataId(
	wikidataId: string,
	fetchFn: typeof fetch = fetch
): Promise<WikidataEntity | null> {
	const data = await sparqlFetch(buildEntityQuery(wikidataId), fetchFn);
	return normalizeEntityResponse(data, wikidataId);
}
