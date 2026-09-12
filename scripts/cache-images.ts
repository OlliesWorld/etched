/**
 * Cache script — download each card's Wikidata (Commons) portrait once and
 * bake a local `image:` path into its frontmatter, the same way athena.md
 * and wonder-woman.md already reference /static files directly.
 *
 * Without this, every page load hits commons.wikimedia.org/wiki/Special:FilePath
 * (a redirect to upload.wikimedia.org) for every card with no `image:` field —
 * this fetches each one exactly once and removes that hotlink + redirect hop
 * from the request path entirely.
 *
 * Usage:
 *   npx tsx scripts/cache-images.ts
 *
 * Only touches cards that have a wikidataId and no existing `image:` field,
 * so re-running is safe.
 */

import { writeFileSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fetchByWikidataId } from '../src/lib/wikidata.js';

const CONTENT_DIR = join(process.cwd(), 'src/content');
const STATIC_DIR = join(process.cwd(), 'static');

const EXT_BY_MIME: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/svg+xml': 'svg'
};

/**
 * Commons thumbnails (?width=…) can convert the on-disk format — e.g. a
 * source .tif is served back as a JPEG — so the URL's own extension isn't
 * trustworthy. Content-Type reflects what actually came back.
 */
function extensionFromContentType(contentType: string | null): string {
	const mime = contentType?.split(';')[0].trim().toLowerCase();
	return (mime && EXT_BY_MIME[mime]) || 'jpg';
}

async function main() {
	const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'));

	for (const file of files) {
		const path = join(CONTENT_DIR, file);
		const raw = readFileSync(path, 'utf-8');

		if (/^image:/m.test(raw)) {
			console.log(`skip (already has image): ${file}`);
			continue;
		}

		const idMatch = raw.match(/^wikidataId:\s*(\S+)/m);
		if (!idMatch) {
			console.log(`skip (no wikidataId): ${file}`);
			continue;
		}
		const wikidataId = idMatch[1];
		const slug = file.replace(/\.md$/, '');

		try {
			const entity = await fetchByWikidataId(wikidataId);
			if (!entity?.imageUrl) {
				console.log(`skip (no P18 image on Wikidata): ${file}`);
				continue;
			}

			const res = await fetch(entity.imageUrl, {
				headers: { 'User-Agent': 'Etched/1.0 (SvelteKit demo app)' }
			});
			if (!res.ok) {
				console.warn(`fetch failed (${res.status}) for ${file}: ${entity.imageUrl}`);
				continue;
			}

			const buf = Buffer.from(await res.arrayBuffer());
			const ext = extensionFromContentType(res.headers.get('content-type'));
			const filename = `${slug}.${ext}`;
			writeFileSync(join(STATIC_DIR, filename), buf);

			const updated = raw.replace(
				/^wikidataId:.*$/m,
				(line) => `${line}\nimage: '/${filename}'`
			);
			writeFileSync(path, updated);

			console.log(`cached: ${file} -> /${filename} (${(buf.length / 1024).toFixed(0)} KB)`);
		} catch (err) {
			console.error(`error on ${file}:`, err instanceof Error ? err.message : err);
		}

		// Be polite to Wikidata/Commons — small delay between entities.
		await new Promise((r) => setTimeout(r, 300));
	}
}

main();
