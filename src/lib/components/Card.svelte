<script module>
	import { SvelteMap } from 'svelte/reactivity';

	// Shared across all Card instances — one AudioContext for the whole page
	let audioCtx: AudioContext | null = null;
	let audioUnlocked = false;
	const audioCache = new SvelteMap<string, AudioBuffer>();

	function getAudioContext(): AudioContext {
		audioCtx ??= new AudioContext();
		return audioCtx;
	}

	export async function unlockAudio() {
		if (audioUnlocked) return;
		const ctx = getAudioContext();
		await ctx.resume();
		audioUnlocked = true;
	}

	export async function playHoverSound(text: string) {
		if (!audioUnlocked) return;
		try {
			const ctx = getAudioContext();

			let audioBuffer = audioCache.get(text);
			if (!audioBuffer) {
				const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}`);
				if (!res.ok) {
					console.error('TTS API error:', res.status, await res.text());
					return;
				}
				const arrayBuf = await res.arrayBuffer();
				audioBuffer = await ctx.decodeAudioData(arrayBuf);
				audioCache.set(text, audioBuffer);
			}

			const source = ctx.createBufferSource();
			source.buffer = audioBuffer;
			source.connect(ctx.destination);
			source.start();
		} catch (e) {
			console.error('playHoverSound failed:', e);
		}
	}
</script>

<script lang="ts">
	import type { Component } from 'svelte';
	import type { Card } from '$lib/cards.server.js';
	import { getDomainPalette } from '$lib/domain-colors.js';
	import Crown from '$lib/assets/crown.svg?raw';

	let { card, Content }: { card: Card; Content?: Component } = $props();
	let revealed = $state(false);
// ≤ 10 lines: read mouse position as 0–1 fractions, push to CSS custom props
	function holographic(node: HTMLElement) {
		const move = (e: MouseEvent) => {
			const b = node.getBoundingClientRect();
			node.style.setProperty('--mouse-x', String((e.clientX - b.left) / b.width));
			node.style.setProperty('--mouse-y', String((e.clientY - b.top) / b.height));
		};
		const leave = () => {
			node.style.setProperty('--mouse-x', '0.5');
			node.style.setProperty('--mouse-y', '0.5');
		};
		node.addEventListener('mousemove', move);
		node.addEventListener('mouseleave', leave);
		return () => { node.removeEventListener('mousemove', move); node.removeEventListener('mouseleave', leave); };
	}
</script>

<div
	{@attach holographic}
	class="card"
	class:is-revealed={revealed}
	onclick={() => { unlockAudio(); revealed = !revealed; }}
	onkeydown={(e) => e.key === 'Enter' && (revealed = !revealed)}
	onmouseenter={() => playHoverSound('water drop, soft liquid swirl,')}
	role="button"
	tabindex="0"
	aria-expanded={revealed}
	aria-label="{card.name} — {revealed ? 'hide' : 'show'} description"
>
	<!-- Front: image only, no text overlay -->
	<div class="image-wrap">
		{#if card.image}
			<img src={card.image} alt={card.name} loading="lazy" />
		{:else}
			<div class="avatar-art">{@html Crown}</div>
		{/if}
	</div>

	<!-- Front footer: name + domain tags — enough to intrigue -->
	<div class="front-footer">
		<h2>{card.name}</h2>
		<div class="tags">
			<span class="tag era">{card.era}</span>
			{#each card.domain as d (d)}
				{@const palette = getDomainPalette(d)}
				<span
					class="tag domain"
					style={`--domain-bg: ${palette.bg}; --domain-fg: ${palette.text}; --domain-border: ${palette.border};`}
				>
					{d}
				</span>
			{/each}
		</div>
	</div>

	<!-- Reveal overlay: slides up on hover (desktop) or tap (mobile) -->
	<div class="reveal" aria-hidden={!revealed}>
		<div class="reveal-content">
			<p class="reveal-name">{card.name}</p>
			{#if card.wikidata?.description}
				<p class="wiki-desc">{card.wikidata.description}</p>
			{/if}
			{#if Content}
				<div class="body"><Content /></div>
			{/if}
			{#if card.wikidataId}
				<a
					class="learn-more"
					href="https://en.wikipedia.org/wiki/{encodeURIComponent(card.name.replace(/ /g, '_'))}"
					target="_blank"
					rel="noopener noreferrer"
					onclick={(e) => e.stopPropagation()}
				>
					Learn more →
				</a>
			{/if}
		</div>
	</div>
</div>

<style>
	/* ─── Registered animatable custom properties ───────────────────────────── */

	@property --mouse-x {
		syntax: '<number>';
		inherits: false;
		initial-value: 0.5;
	}
	@property --mouse-y {
		syntax: '<number>';
		inherits: false;
		initial-value: 0.5;
	}

	/* ─── Card container ────────────────────────────────────────────────────── */

	.card {
		position: relative;
		border-radius: 1rem;
		overflow: hidden;
		isolation: isolate;

		background: linear-gradient(145deg, #16132a 0%, #0e0c1e 55%, #12102a 100%);
		color: #e8e8f0;

		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow:
			calc((var(--mouse-x) - 0.5) * 40px) calc((var(--mouse-y) - 0.5) * 28px) 48px rgba(0, 0, 0, 0.6),
			0 0 0 1px rgba(255, 255, 255, 0.07),
			inset 0 1px 0 rgba(255, 255, 255, 0.07);

		transform:
			perspective(700px)
			rotateY(calc(var(--mouse-x) * 25deg - 12.5deg))
			rotateX(calc(var(--mouse-y) * -20deg + 10deg));

		transition:
			transform 0.1s ease-out,
			box-shadow 0.12s ease-out;

		touch-action: manipulation;
		cursor: pointer;
	}

	.card:hover {
		border-color: rgba(200, 170, 255, 0.25);
	}

	/* ─── ::before — mouse spotlight ────────────────────────────────────────── */

	.card::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 3;
		border-radius: inherit;
		pointer-events: none;

		background:
			radial-gradient(
				ellipse 80% 80% at calc(var(--mouse-x) * 100%) calc(var(--mouse-y) * 100%),
				rgba(255, 255, 255, 0.18) 0%,
				hsl(calc(var(--mouse-x) * 360) 100% 72% / 0.24) 28%,
				hsl(calc(var(--mouse-x) * 360 + 120) 80% 65% / 0.08) 52%,
				transparent 68%
			);

		mix-blend-mode: overlay;
		opacity: 0;
		transition: opacity 0.35s ease;
	}

	.card:hover::before {
		opacity: 1;
	}

	/* ─── ::after — rainbow foil on hover ───────────────────────────────────── */

	.card::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 2;
		border-radius: inherit;
		pointer-events: none;

		background:
			linear-gradient(
				calc(var(--mouse-x) * 360deg),
				hsl(0   100% 55% / 0.14),
				hsl(60  100% 60% / 0.11),
				hsl(120 100% 55% / 0.14),
				hsl(180 100% 60% / 0.11),
				hsl(240 100% 55% / 0.14),
				hsl(300 100% 60% / 0.11)
			);

		mix-blend-mode: color-dodge;
		opacity: 0;
		transition: opacity 0.45s ease;
	}

	.card:hover::after {
		opacity: 0.6;
	}

	/* ─── Image area ────────────────────────────────────────────────────────── */

	.image-wrap {
		position: relative;
		width: 100%;
		height: 250px;
		overflow: hidden;
		background:
			radial-gradient(ellipse at 30% 40%, #2a1060 0%, transparent 55%),
			radial-gradient(ellipse at 72% 62%, #0a2f5e 0%, transparent 55%),
			#06041a;
	}

	.image-wrap img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}

	.avatar-art {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.avatar-art :global(svg) {
		width: 55%;
		height: auto;
		opacity: 0.18;
	}

	/* ─── Front footer ──────────────────────────────────────────────────────── */

	.front-footer {
		position: relative;
		z-index: 1;
		padding: 0.85rem 1.1rem 1rem;
		background: rgba(10, 8, 24, 0.92);
		backdrop-filter: blur(12px) saturate(140%);
		-webkit-backdrop-filter: blur(12px) saturate(140%);
		border-top: 1px solid rgba(255, 255, 255, 0.07);
	}

	h2 {
		margin: 0 0 0.5rem;
		font-size: 1.28rem;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.tag {
		font-size: 0.67rem;
		padding: 0.18rem 0.52rem;
		border-radius: 999px;
		text-transform: capitalize;
		letter-spacing: 0.04em;
		font-weight: 500;
		backdrop-filter: blur(8px) saturate(130%);
		-webkit-backdrop-filter: blur(8px) saturate(130%);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
	}

	.era    { background: #0f2e45; color: #7ec8f5; border: 1px solid rgba(126, 200, 245, 0.25); }
	.domain {
		background: var(--domain-bg, #0e2e1e);
		color: var(--domain-fg, #6deda0);
		border: 1px solid var(--domain-border, #2a7b4d);
		font-weight: 500;
	}

	/* ─── Reveal overlay ────────────────────────────────────────────────────── */

	.reveal {
		position: absolute;
		inset: 0;
		z-index: 4;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;

		background: linear-gradient(
			to bottom,
			transparent          0%,
			transparent          16%,
			rgba(8, 4, 22, 0.82) 34%,
			rgba(8, 4, 22, 0.97) 54%
		);

		opacity: 0;
		transform: translateY(14px);
		transition:
			opacity 0.35s ease,
			transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
		pointer-events: none;
	}

	@media (hover: hover) {
		.card:hover .reveal {
			opacity: 1;
			transform: none;
			pointer-events: auto;
		}
	}

	.card.is-revealed .reveal {
		opacity: 1;
		transform: none;
		pointer-events: auto;
	}

	.reveal-content {
		padding: 1rem 1.1rem 1.1rem;
	}

	.reveal-name {
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #c084fc;
		margin: 0 0 0.45rem;
	}

	.wiki-desc {
		font-size: 0.78rem;
		color: #8888a8;
		font-style: italic;
		margin: 0 0 0.5rem;
		line-height: 1.45;
	}

	.body {
		font-size: 0.86rem;
		line-height: 1.65;
		color: #cccce0;
	}

	.body :global(p) {
		margin: 0;
	}

	.learn-more {
		display: inline-block;
		margin-top: 0.6rem;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		color: #c084fc;
		text-decoration: none;
		border-bottom: 1px solid rgba(192, 132, 252, 0.45);
		transition: color 0.2s ease, border-color 0.2s ease;
	}

	.learn-more:hover {
		color: #e9d5ff;
		border-bottom-color: rgba(233, 213, 255, 0.7);
	}
</style>
