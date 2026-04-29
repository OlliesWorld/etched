import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { ELEVENLABS_API_KEY } from '$env/static/private';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const elevenlabs = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });

// Simple in-memory cache: text → ArrayBuffer
const cache = new Map<string, ArrayBuffer>();

export const GET: RequestHandler = async ({ url }) => {
	const text = url.searchParams.get('text');
	if (!text) throw error(400, 'Missing text parameter');

	if (cache.has(text)) {
		return new Response(cache.get(text)!, {
			headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=3600' }
		});
	}

	let audio: ReadableStream<Uint8Array>;
	try {
		audio = await elevenlabs.textToSoundEffects.convert({
			text,
			durationSeconds: 1.5,
			promptInfluence: 0.5
		});
	} catch (e) {
		console.error('ElevenLabs error:', e);
		throw error(502, `ElevenLabs failed: ${e instanceof Error ? e.message : String(e)}`);
	}

	const reader = audio.getReader();
	const chunks: Uint8Array[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}
	const total = chunks.reduce((n, c) => n + c.byteLength, 0);
	const buf = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		buf.set(chunk, offset);
		offset += chunk.byteLength;
	}

	cache.set(text, buf.buffer);

	return new Response(buf.buffer, {
		headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=3600' }
	});
};
