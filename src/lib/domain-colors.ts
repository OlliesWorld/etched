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
	{ bg: 'rgba(66, 138, 245, 0.15)',  text: '#90bff0', border: 'rgba(110, 166, 235, 0.32)' },
	{ bg: 'rgba(57, 184, 142, 0.15)',  text: '#88d9b8', border: 'rgba(100, 210, 165, 0.32)' },
	{ bg: 'rgba(230, 157, 65, 0.15)',  text: '#e0bc88', border: 'rgba(220, 175, 100, 0.32)' },
	{ bg: 'rgba(210, 90, 115, 0.15)',  text: '#e0a0b5', border: 'rgba(220, 130, 155, 0.32)' },
	{ bg: 'rgba(125, 100, 220, 0.15)', text: '#b8b0f0', border: 'rgba(155, 140, 240, 0.32)' },
	{ bg: 'rgba(70, 190, 210, 0.15)',  text: '#88dce8', border: 'rgba(100, 215, 230, 0.32)' },
	{ bg: 'rgba(180, 90, 200, 0.15)',  text: '#d0a0e0', border: 'rgba(200, 130, 220, 0.32)' },
	{ bg: 'rgba(100, 175, 90, 0.15)',  text: '#98d090', border: 'rgba(130, 200, 120, 0.32)' },
	{ bg: 'rgba(220, 130, 50, 0.15)',  text: '#d8a870', border: 'rgba(210, 155, 80, 0.32)'  },
	{ bg: 'rgba(60, 150, 180, 0.15)',  text: '#80c8e0', border: 'rgba(90, 175, 205, 0.32)'  },
	{ bg: 'rgba(200, 80, 80, 0.15)',   text: '#d89090', border: 'rgba(210, 115, 115, 0.32)' },
	{ bg: 'rgba(140, 160, 80, 0.15)',  text: '#bac870', border: 'rgba(165, 185, 100, 0.32)' }
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