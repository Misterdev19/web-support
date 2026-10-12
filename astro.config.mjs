// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	fonts: [
		{
			provider: fontProviders.fontsource(),
			name: 'Oswald',
			cssVariable: '--font-oswald',
			weights: [500, 700],
		},
		{
			provider: fontProviders.fontsource(),
			name: 'Inter',
			cssVariable: '--font-inter',
			weights: [400, 500],
		},
		{
			provider: fontProviders.fontsource(),
			name: 'JetBrains Mono',
			cssVariable: '--font-jetbrains-mono',
			weights: [400, 500],
		},
	],
});
