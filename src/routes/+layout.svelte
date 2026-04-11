<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
	:global(*, *::before, *::after) {
		box-sizing: border-box;
	}

	:global(html) {
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif;
		background: #0a0a1a;
		color: #e8e8f0;
		min-height: 100%;
	}

	:global(body) {
		margin: 0;
		min-height: 100vh;
		background: radial-gradient(ellipse at 20% 10%, #1a0a3a 0%, transparent 50%),
			radial-gradient(ellipse at 80% 90%, #0a1a3a 0%, transparent 50%), #0a0a1a;
	}
</style>
