<script lang="ts">
	import type { Component } from 'svelte';
	import type { PageData } from './$types.js';
	import Card from '$lib/components/Card.svelte';
	import { getDomainPalette } from '$lib/domain-colors.js';

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

	const TYPE_PALETTES: Record<string, { bg: string; text: string; border: string }> = {
		historical: { bg: '#372c11', text: '#f0d98f', border: '#8b742b' },
		mythological: { bg: '#3d1f6e', text: '#c4a0ff', border: '#6b48b4' },
		fictional: { bg: '#0f2e45', text: '#7ec8f5', border: '#3476a0' }
	};

	function getTypePalette(type: string) {
		return TYPE_PALETTES[type.toLowerCase()] ?? { bg: '#171231', text: '#d8cffd', border: '#3a315f' };
	}

	const types = $derived(Array.from(new Set(data.cards.map((card) => card.type))).sort());

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
			<div class="filter-buttons">
				<button
					type="button"
					class="all-filter"
					class:active={selectedType === 'all'}
					onclick={() => (selectedType = 'all')}
				>
					All
				</button>

				{#each types as type (type)}
					{@const typePalette = getTypePalette(type)}
					<button
						type="button"
						class="type-filter"
						class:active={selectedType === type}
						style={`--type-bg: ${typePalette.bg}; --type-fg: ${typePalette.text}; --type-border: ${typePalette.border};`}
						onclick={() => (selectedType = type)}
					>
						{type}
					</button>
				{/each}
			</div>
		</div>

		<div class="filter-group" aria-label="Filter cards by domain">
			<p class="filter-label">Domain</p>
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

	.filters button {
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

	.filters .all-filter {
		border: 1px solid rgba(188, 180, 245, 0.5);
		background: linear-gradient(135deg, rgba(125, 114, 212, 0.24), rgba(89, 154, 221, 0.16));
		color: #e8e2ff;
	}

	.filters .domain-filter {
		border: 1px solid var(--filter-border, #2a7b4d);
		background: var(--filter-bg, #0e2e1e);
		color: var(--filter-fg, #6deda0);
		font-weight: 500;
	}

	.filters .type-filter {
		border: 1px solid var(--type-border, #8b742b);
		background: var(--type-bg, #372c11);
		color: var(--type-fg, #f0d98f);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.filters button:hover {
		transform: translateY(-1px);
		filter: brightness(1.12);
	}

	.filters .domain-filter.active {
		background: color-mix(in oklab, var(--filter-bg, rgba(66, 138, 245, 0.2)) 72%, white);
		border-color: color-mix(in oklab, var(--filter-border, rgba(130, 186, 255, 0.42)) 68%, white);
		color: color-mix(in oklab, var(--filter-fg, #a8d4ff) 86%, white);
	}

	.filters .type-filter.active {
		background: color-mix(in oklab, var(--type-bg, rgba(236, 179, 89, 0.2)) 72%, white);
		border-color: color-mix(in oklab, var(--type-border, rgba(255, 208, 135, 0.5)) 68%, white);
		color: color-mix(in oklab, var(--type-fg, #ffe0ac) 86%, white);
	}

	.filters .all-filter.active {
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
