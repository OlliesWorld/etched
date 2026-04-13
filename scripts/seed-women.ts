/**
 * Seed script — bulk-generate content files from Wikidata, filtered by Claude.
 *
 * Usage:
 *   npx tsx scripts/seed-women.ts              # fetch 100, score all
 *   npx tsx scripts/seed-women.ts 200          # fetch 200, score all
 *   npx tsx scripts/seed-women.ts 200 --threshold=7   # stricter cutoff
 *
 * Kept entries  → src/content/<slug>.md
 * Rejected entries → scripts/rejected.json  (review and override manually)
 *
 * Only creates .md files that don't already exist, so re-running is safe.
 * ANTHROPIC_API_KEY must be set in your environment.
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

// ── Config ────────────────────────────────────────────────────────────────────

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const CONTENT_DIR     = join(process.cwd(), 'src/content');
const REJECTED_FILE   = join(process.cwd(), 'scripts/rejected.json');
const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';

const REQUEST_TIMEOUT_MS  = 90_000;
const MAX_RETRIES         = 3;
const SPARQL_BATCH_SIZE   = 50;
const SCORE_BATCH_SIZE    = 10;
const SPARQL_DELAY_MS     = 500;
const SCORE_DELAY_MS      = 800;

// Parse CLI args
const args = process.argv.slice(2);
const thresholdArg = args.find(a => a.startsWith('--threshold='));
const threshold    = thresholdArg ? parseInt(thresholdArg.split('=')[1], 10) : 6;
const limit        = parseInt(args.find(a => !a.startsWith('--')) ?? '100', 10);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
if (!ANTHROPIC_API_KEY) {
	console.error('Error: ANTHROPIC_API_KEY is not set.');
	process.exit(1);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Entity {
	id: string;
	name: string;
	description: string;
	born?: string;
	died?: string;
}

interface ScoreResult {
	score: number;
	reason: string;
	keep: boolean;
}

// ── SPARQL ────────────────────────────────────────────────────────────────────

// Simple query — no label SERVICE (causes 504s). Labels fetched separately via wbgetentities.
function buildQuery(batchSize: number, offset: number): string {
	return `
SELECT ?item ?birthDate ?deathDate WHERE {
  ?item wdt:P31 wd:Q5 ;
        wdt:P21 wd:Q6581072 .
  OPTIONAL { ?item wdt:P569 ?birthDate . }
  OPTIONAL { ?item wdt:P570 ?deathDate . }
}
LIMIT ${batchSize} OFFSET ${offset}
`;
}

// Fetch labels + descriptions from the Wikidata entities API (up to 50 QIDs at a time)
async function fetchLabels(ids: string[]): Promise<Map<string, { name: string; description: string }>> {
	const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=labels|descriptions&languages=en&format=json&origin=*`;
	const res = await fetch(url, { headers: { 'User-Agent': 'Etched/1.0 seed-script' } });
	if (!res.ok) throw new Error(`wbgetentities failed: ${res.status}`);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const json: any = await res.json();
	const out = new Map<string, { name: string; description: string }>();
	for (const [id, entity] of Object.entries(json.entities ?? {})) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const e = entity as any;
		const name: string = e.labels?.en?.value ?? '';
		const description: string = e.descriptions?.en?.value ?? '';
		if (name) out.set(id, { name, description });
	}
	return out;
}

async function fetchSparql(query: string): Promise<Response> {
	const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;

	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		try {
			const res = await fetch(url, {
				headers: {
					Accept: 'application/sparql-results+json',
					'User-Agent': 'Etched/1.0 seed-script'
				},
				signal: controller.signal
			});
			clearTimeout(timer);

			if (res.ok) return res;

			const retryable = [429, 500, 502, 503, 504].includes(res.status);
			console.log(`  SPARQL ${attempt}: got ${res.status}${retryable && attempt < MAX_RETRIES ? ', retrying…' : '.'}`);
			if (!retryable || attempt === MAX_RETRIES)
				throw new Error(`SPARQL failed: ${res.status} ${res.statusText}`);
		} catch (err) {
			clearTimeout(timer);
			if (attempt === MAX_RETRIES) throw err;
			console.log(`  SPARQL ${attempt}: errored, retrying…`);
		}

		await sleep(1500 * 2 ** (attempt - 1));
	}
	throw new Error('SPARQL failed after all retries.');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function slugify(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function extractYear(isoDate?: string): string | undefined {
	if (!isoDate) return undefined;
	const m = isoDate.match(/^([+-]?\d+)-/);
	return m ? String(parseInt(m[1], 10)) : undefined;
}

function guessDomain(description: string): string[] {
	const mapping: Record<string, string> = {
		politician: 'politics',   activist: 'activism',      scientist: 'science',
		physicist: 'science',     chemist: 'science',        biologist: 'science',
		mathematician: 'science', physician: 'medicine',     nurse: 'medicine',
		author: 'literature',     writer: 'literature',      novelist: 'literature',
		poet: 'literature',       philosopher: 'philosophy', artist: 'art',
		painter: 'art',           sculptor: 'art',           musician: 'music',
		singer: 'music',          composer: 'music',         actor: 'performance',
		actress: 'performance',   filmmaker: 'film',         explorer: 'exploration',
		aviator: 'aviation',      pilot: 'aviation',         engineer: 'engineering',
		architect: 'architecture',lawyer: 'law',             judge: 'law',
		economist: 'economics',   astronaut: 'space',        soldier: 'military',
		general: 'military',      humanitarian: 'humanitarianism',
		educator: 'education',    teacher: 'education'
	};
	const key = description.toLowerCase();
	const domains = new Set<string>();
	for (const [kw, domain] of Object.entries(mapping))
		if (key.includes(kw)) domains.add(domain);
	return domains.size > 0 ? Array.from(domains) : ['history'];
}

function guessEra(born?: string): string {
	if (!born) return 'unknown';
	const y = parseInt(born, 10);
	if (y < 500)  return 'ancient';
	if (y < 1400) return 'medieval';
	if (y < 1800) return 'early-modern';
	if (y < 1950) return 'modern';
	return 'contemporary';
}

// ── Claude scoring ────────────────────────────────────────────────────────────

async function scoreEntity(entity: Entity): Promise<ScoreResult> {
	const prompt = `Score this woman for inclusion in a card collection about remarkable women in history.

Name: ${entity.name}
Description: ${entity.description}${entity.born ? `\nBorn: ${entity.born}` : ''}${entity.died ? `, Died: ${entity.died}` : ''}

BOOST (score higher if):
- Did something first in her field or in history
- Changed a field, system, or law that still affects people today
- Story feels surprising or underknown
- Represents a culture, era, or domain that's rare

CUT (score lower if):
- Famous primarily because of who she married or was related to
- Has a Wikipedia page but no real cultural footprint or lasting impact

Respond with JSON only — no explanation, no markdown:
{"score": <1-10>, "reason": "<one sentence>", "keep": <true if score >= ${threshold}, else false>}`;

	const res = await fetch(CLAUDE_ENDPOINT, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': ANTHROPIC_API_KEY,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model: 'claude-haiku-4-5',
			max_tokens: 128,
			messages: [{ role: 'user', content: prompt }]
		})
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Claude API error: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const json: any = await res.json();
	const text: string = json.content?.[0]?.text?.trim() ?? '{}';

	// Strip any accidental markdown fences
	const clean = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/,'').trim();
	return JSON.parse(clean) as ScoreResult;
}

async function scoreInBatches(entities: Entity[]): Promise<Map<string, ScoreResult>> {
	const results = new Map<string, ScoreResult>();

	for (let i = 0; i < entities.length; i += SCORE_BATCH_SIZE) {
		const batch = entities.slice(i, i + SCORE_BATCH_SIZE);
		const batchNum = Math.floor(i / SCORE_BATCH_SIZE) + 1;
		const totalBatches = Math.ceil(entities.length / SCORE_BATCH_SIZE);
		console.log(`\n  Scoring batch ${batchNum}/${totalBatches} (${batch.length} entries)…`);

		const scored = await Promise.all(
			batch.map(async entity => {
				try {
					const result = await scoreEntity(entity);
					return { entity, result };
				} catch (err) {
					console.warn(`  ⚠ scoring failed for ${entity.name}: ${err}`);
					// Default to keeping on error so we don't silently drop entries
					return { entity, result: { score: 5, reason: 'scoring error — defaulted to keep', keep: true } };
				}
			})
		);

		for (const { entity, result } of scored) {
			const icon = result.keep ? '✓' : '✗';
			console.log(`    ${icon} [${result.score}/10] ${entity.name}: ${result.reason}`);
			results.set(entity.id, result);
		}

		if (i + SCORE_BATCH_SIZE < entities.length) await sleep(SCORE_DELAY_MS);
	}

	return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

mkdirSync(CONTENT_DIR, { recursive: true });

console.log(`Fetching up to ${limit} women from Wikidata (${SPARQL_BATCH_SIZE}/batch)…`);
console.log(`Scoring with claude-haiku-4-5 — threshold: ${threshold}/10\n`);

const entityMap = new Map<string, Entity>();
let offset = 0;

// Phase 1 — fetch from Wikidata
while (entityMap.size < limit) {
	const batchNum = Math.floor(offset / SPARQL_BATCH_SIZE) + 1;
	console.log(`Wikidata batch ${batchNum}: rows ${offset}–${offset + SPARQL_BATCH_SIZE - 1}…`);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let json: any;
	try {
		const res = await fetchSparql(buildQuery(SPARQL_BATCH_SIZE, offset));
		json = await res.json();
	} catch (err) {
		console.error(`  Failed: ${err}`);
		break;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const bindings: any[] = json?.results?.bindings ?? [];

	// Collect new IDs + dates from SPARQL, then fetch labels separately
	const newIds: Array<{ id: string; born?: string; died?: string }> = [];
	for (const b of bindings) {
		const itemUrl: string = b.item?.value ?? '';
		const id = itemUrl.split('/').pop() ?? '';
		if (!id.startsWith('Q') || entityMap.has(id)) continue;
		newIds.push({ id, born: extractYear(b.birthDate?.value), died: extractYear(b.deathDate?.value) });
	}

	// Fetch labels in sub-batches of 50 (API limit)
	let added = 0;
	for (let j = 0; j < newIds.length; j += 50) {
		const chunk = newIds.slice(j, j + 50);
		let labels: Map<string, { name: string; description: string }>;
		try {
			labels = await fetchLabels(chunk.map(e => e.id));
		} catch (err) {
			console.warn(`  ⚠ labels fetch failed: ${err}`);
			labels = new Map();
		}
		for (const { id, born, died } of chunk) {
			const label = labels.get(id);
			if (!label?.name || !label?.description) continue;
			entityMap.set(id, { id, name: label.name, description: label.description, born, died });
			added++;
		}
	}

	console.log(`  → ${bindings.length} rows, ${added} new entities (total: ${entityMap.size})`);

	if (bindings.length < SPARQL_BATCH_SIZE) { console.log('  No more Wikidata results.'); break; }
	offset += SPARQL_BATCH_SIZE;
	await sleep(SPARQL_DELAY_MS);
}

const allEntities = Array.from(entityMap.values());
console.log(`\n${allEntities.length} entities fetched. Scoring…`);

// Phase 2 — score via Claude
const scores = await scoreInBatches(allEntities);

// Phase 3 — write files + update rejected.json
const rejected: Array<{ id: string; name: string; description: string; score: number; reason: string }> = [];

// Load existing rejected list so we don't overwrite manual overrides
if (existsSync(REJECTED_FILE)) {
	try {
		const existing = JSON.parse(readFileSync(REJECTED_FILE, 'utf8'));
		if (Array.isArray(existing)) rejected.push(...existing);
	} catch { /* ignore malformed file */ }
}
const rejectedIds = new Set(rejected.map(r => r.id));

let created = 0;
let skipped = 0;
let rejectedCount = 0;

console.log('\nWriting files…');

for (const entity of allEntities) {
	const result = scores.get(entity.id) ?? { score: 5, reason: 'no score', keep: true };

	if (!result.keep) {
		if (!rejectedIds.has(entity.id)) {
			rejected.push({ id: entity.id, name: entity.name, description: entity.description, score: result.score, reason: result.reason });
			rejectedIds.add(entity.id);
		}
		rejectedCount++;
		continue;
	}

	const slug = slugify(entity.name);
	const filePath = join(CONTENT_DIR, `${slug}.md`);
	if (existsSync(filePath)) { skipped++; continue; }

	const domains = guessDomain(entity.description);
	const era = guessEra(entity.born);
	const frontmatter = [
		'---',
		`name: "${entity.name.replace(/"/g, '\\"')}"`,
		`type: historical`,
		`era: ${era}`,
		`domain: [${domains.join(', ')}]`,
		`wikidataId: ${entity.id}`,
		'---',
		'',
		entity.description,
		''
	].join('\n');

	writeFileSync(filePath, frontmatter, 'utf8');
	console.log(`  + ${slug}.md  (${result.score}/10 — ${result.reason})`);
	created++;
}

writeFileSync(REJECTED_FILE, JSON.stringify(rejected, null, 2), 'utf8');

console.log(`
Done.
  Created : ${created} files
  Skipped : ${skipped} (already exist)
  Rejected: ${rejectedCount} (see scripts/rejected.json to review)
`);
