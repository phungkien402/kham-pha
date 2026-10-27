// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';
import { site } from './src/config/site.ts';

// https://astro.build/config
export default defineConfig({
  site: site.url,
  output: 'static',
  integrations: [svelte(), sitemap()],
});
