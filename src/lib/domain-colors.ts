export interface DomainPalette {
	bg: string;
	text: string;
	border: string;
}

export interface TypePalette {
	bg: string;
	text: string;
	border: string;
}

const DOMAIN_PALETTES: DomainPalette[] = [
	{ bg: 'rgba(66, 138, 245, 0.2)', text: '#a8d4ff', border: 'rgba(130, 186, 255, 0.42)' },
	{ bg: 'rgba(57, 184, 142, 0.2)', text: '#a5f0d0', border: 'rgba(123, 232, 187, 0.44)' },
	{ bg: 'rgba(230, 157, 65, 0.2)', text: '#ffd9a8', border: 'rgba(255, 197, 127, 0.42)' },
	{ bg: 'rgba(224, 96, 125, 0.2)', text: '#ffc0d0', border: 'rgba(255, 155, 180, 0.44)' },
	{ bg: 'rgba(125, 120, 235, 0.2)', text: '#cfccff', border: 'rgba(169, 165, 255, 0.44)' },
	{ bg: 'rgba(82, 196, 210, 0.2)', text: '#b8f2f8', border: 'rgba(128, 233, 244, 0.44)' }
];

function hashDomain(value: string): number {
	let hash = 0;
	for (let i = 0; i < value.length; i += 1) {
		hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
	}
	return hash;
}

export function getDomainPalette(domain: string): DomainPalette {
	if (!domain) return DOMAIN_PALETTES[0];
	return DOMAIN_PALETTES[hashDomain(domain.toLowerCase()) % DOMAIN_PALETTES.length];
}

const TYPE_PALETTES: Record<string, TypePalette> = {
	historical: {
		bg: 'rgba(236, 179, 89, 0.2)',
		text: '#ffe0ac',
		border: 'rgba(255, 208, 135, 0.5)'
	},
	mythological: {
		bg: 'rgba(170, 118, 240, 0.2)',
		text: '#e6cbff',
		border: 'rgba(204, 161, 255, 0.5)'
	},
	fictional: {
		bg: 'rgba(92, 171, 235, 0.2)',
		text: '#bde5ff',
		border: 'rgba(146, 200, 245, 0.5)'
	}
};

const DEFAULT_TYPE_PALETTE: TypePalette = {
	bg: 'rgba(139, 132, 197, 0.2)',
	text: '#ddd8ff',
	border: 'rgba(178, 171, 234, 0.5)'
};

export function getTypePalette(type: string): TypePalette {
	return TYPE_PALETTES[type.toLowerCase()] ?? DEFAULT_TYPE_PALETTE;
}