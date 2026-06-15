<script lang="ts">
	import type { Component } from 'svelte';
	import type { PageData } from './$types.js';
	import Card from '$lib/components/Card.svelte';
	import { getDomainPalette, getTypePalette } from '$lib/domain-colors.js';

	// Eagerly import all .md files as Svelte components so the body renders
	// natively — no {@html} needed and mdsvex styles stay scoped.
	type MdModule = { default: Component; metadata: unknown };
	const contentModules = import.meta.glob<MdModule>('../content/*.md', { eager: true });

	const contentMap: Record<string, Component> = Object.fromEntries(
		Object.entries(contentModules).map(([path, mod]) => [
			path.replace('../content/', '').replace('.md', ''),
			mod.default
		])
	);

	let { data }: { data: PageData } = $props();
	let selectedType = $state<string>('all');
	let selectedDomain = $state<string>('all');
	let domainsExpanded = $state(false);

	const types = $derived(Array.from(new Set(data.cards.map((card) => card.type))).sort());
	const typeOptions = $derived(['all', ...types]);
	const selectedTypeIndex = $derived(typeOptions.indexOf(selectedType));
	const indicatorStyle = $derived(
		selectedType === 'all'
			? '--indicator-bg: rgba(125, 114, 212, 0.35); --indicator-border: rgba(188, 180, 245, 0.5);'
			: `--indicator-bg: ${getTypePalette(selectedType).bg}; --indicator-border: ${getTypePalette(selectedType).border};`
	);

	const domains = $derived(
		Array.from(new Set(data.cards.flatMap((card) => card.domain))).sort((a, b) =>
			a.localeCompare(b)
		)
	);

	const filteredCards = $derived(
		data.cards.filter((card) => {
			const typeMatches = selectedType === 'all' || card.type === selectedType;
			const domainMatches = selectedDomain === 'all' || card.domain.includes(selectedDomain);
			return typeMatches && domainMatches;
		})
	);
</script>

<svelte:head>
	<title>Etched</title>
	<meta name="description" content="Etched — because they were never going to be forgotten." />
</svelte:head>

<main>
	<header>
		<h1>Etched</h1>
		<p>because they were never going to be forgotten.</p>
	</header>

	<div class="filters" aria-label="Card filters">
		<div class="filter-group" aria-label="Filter cards by type">
			<p class="filter-label">Type</p>
			<div
				class="segment-track"
				style="--total: {typeOptions.length}; --idx: {selectedTypeIndex}; {indicatorStyle}"
			>
				<div class="segment-indicator"></div>
				{#each typeOptions as opt (opt)}
					<button
						type="button"
						class="segment-btn"
						class:active={selectedType === opt}
						onclick={() => (selectedType = opt)}
					>
						{opt}
					</button>
				{/each}
			</div>
		</div>

		<div class="filter-group" aria-label="Filter cards by domain">
			<p class="filter-label">Domain</p>
			<div class="domain-wrap" class:expanded={domainsExpanded}>
				<div class="filter-buttons">
					<button
						type="button"
						class="all-filter"
						class:active={selectedDomain === 'all'}
						onclick={() => (selectedDomain = 'all')}
					>
						All
					</button>

					{#each domains as domain (domain)}
						{@const domainPalette = getDomainPalette(domain)}
						<button
							type="button"
							class="domain-filter"
							class:active={selectedDomain === domain}
							style={`--filter-bg: ${domainPalette.bg}; --filter-fg: ${domainPalette.text}; --filter-border: ${domainPalette.border};`}
							onclick={() => (selectedDomain = domain)}
						>
							{domain}
						</button>
					{/each}
				</div>
			</div>
			<button type="button" class="more-btn" onclick={() => (domainsExpanded = !domainsExpanded)}>
				{domainsExpanded ? 'Less ▲' : 'More ▾'}
			</button>
		</div>
	</div>

	<div class="grid">
		{#each filteredCards as card (card.slug)}
			<Card {card} Content={contentMap[card.slug]} />
		{/each}
	</div>
</main>

<style>
	main {
		max-width: 1200px;
		margin: 0 auto;
		padding: 3rem 2rem;
	}

	header {
		text-align: center;
		margin-bottom: 3.5rem;
	}

	h1 {
		font-size: clamp(2.5rem, 6vw, 4rem);
		font-weight: 800;
		letter-spacing: -0.03em;
		margin: 0;
		background: linear-gradient(135deg, #c4a0ff, #7ec8f5, #6deda0);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	header p {
		color: #7070a0;
		margin-top: 0.6rem;
		font-size: 1rem;
	}

	.filters {
		display: grid;
		gap: 0.9rem;
		margin-bottom: 1.8rem;
	}

	.filter-group {
		display: grid;
		gap: 0.45rem;
	}

	.filter-label {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #8f8ab5;
		text-align: center;
	}

	.filter-buttons {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.6rem;
	}

	/* Domain collapse/expand */
	.domain-wrap {
		/* One row of buttons: ~1.61rem button height */
		max-height: 2.1rem;
		overflow: hidden;
		transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
		/* Fade out the bottom edge to hint there's more */
		mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
		-webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
	}

	.domain-wrap.expanded {
		max-height: 400px;
		mask-image: none;
		-webkit-mask-image: none;
	}

	.more-btn {
		display: block;
		margin: 0.3rem auto 0;
		padding: 0.2rem 0.7rem;
		background: none;
		border: none;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		color: #8f8ab5;
		cursor: pointer;
		transition: color 120ms ease;
	}

	.more-btn:hover {
		color: #c4a0ff;
	}

	/* ── Segmented control (type) ───────────────────────────────────────────── */

	.segment-track {
		position: relative;
		display: grid;
		grid-template-columns: repeat(var(--total, 4), 1fr);
		background: rgba(255, 255, 255, 0.04);
		border-radius: 999px;
		padding: 3px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		max-width: 420px;
		margin: 0 auto;
	}

	.segment-indicator {
		position: absolute;
		top: 3px;
		bottom: 3px;
		left: calc(var(--idx, 0) * 100% / var(--total, 4));
		width: calc(100% / var(--total, 4));
		border-radius: 999px;
		background: var(--indicator-bg, rgba(125, 114, 212, 0.35));
		border: 1px solid var(--indicator-border, rgba(188, 180, 245, 0.5));
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 4px 12px rgba(0, 0, 0, 0.3);
		transition:
			left 0.25s cubic-bezier(0.4, 0, 0.2, 1),
			background 0.25s ease,
			border-color 0.25s ease;
		pointer-events: none;
	}

	.segment-btn {
		position: relative;
		z-index: 1;
		padding: 0.38rem 0.5rem;
		background: none;
		border: none;
		border-radius: 999px;
		font-size: 0.82rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: capitalize;
		color: #6a668f;
		cursor: pointer;
		transition: color 0.2s ease;
	}

	.segment-btn.active {
		color: #e8e2ff;
	}

	.segment-btn:hover:not(.active) {
		color: #c4a0ff;
	}

	/* ── Domain pill buttons ─────────────────────────────────────────────────── */

	.filter-buttons button {
		padding: 0.38rem 0.8rem;
		border-radius: 999px;
		font-size: 0.85rem;
		line-height: 1;
		text-transform: capitalize;
		font-weight: 600;
		cursor: pointer;
		backdrop-filter: blur(10px) saturate(130%);
		-webkit-backdrop-filter: blur(10px) saturate(130%);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 6px 14px rgba(0, 0, 0, 0.22);
		transition:
			transform 120ms ease,
			background-color 120ms ease,
			border-color 120ms ease,
			color 120ms ease;
	}

	.filter-buttons .all-filter {
		border: 1px solid rgba(188, 180, 245, 0.5);
		background: linear-gradient(135deg, rgba(125, 114, 212, 0.24), rgba(89, 154, 221, 0.16));
		color: #e8e2ff;
	}

	.filter-buttons .domain-filter {
		border: 1px solid var(--filter-border, rgba(130, 186, 255, 0.32));
		background: var(--filter-bg, rgba(66, 138, 245, 0.15));
		color: var(--filter-fg, #90bff0);
		font-weight: 500;
	}

	.filter-buttons button:hover {
		transform: translateY(-1px);
		filter: brightness(1.12);
	}

	.filter-buttons .domain-filter.active {
		background: color-mix(in oklab, var(--filter-bg, rgba(66, 138, 245, 0.15)) 60%, white);
		border-color: color-mix(in oklab, var(--filter-border, rgba(130, 186, 255, 0.32)) 55%, white);
		color: color-mix(in oklab, var(--filter-fg, #90bff0) 80%, white);
	}

	.filter-buttons .all-filter.active {
		background: linear-gradient(135deg, rgba(146, 137, 220, 0.38), rgba(99, 176, 233, 0.24));
		border-color: rgba(204, 195, 255, 0.72);
		color: #ffffff;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 2rem;
	}
</style>
