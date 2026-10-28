// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';
import { site } from './src/config/site.ts';
import pages from './src/data/pages.json' with { type: 'json' };

// Trang `draft` vẫn build được nhưng không được vào sitemap.
const draftPaths = pages.filter((p) => p.status === 'draft').map((p) => `/${p.slug}/`);

// https://astro.build/config
export default defineConfig({
  site: site.url,
  output: 'static',
  integrations: [
    svelte(),
    sitemap({
      filter: (url) => {
        const pathname = new URL(url).pathname;
        if (pathname === '/admin' || pathname.startsWith('/admin/')) return false;
        if (pathname === '/gui-anh' || pathname.startsWith('/gui-anh/')) return false;
        return !draftPaths.some((path) => pathname === path);
      },
    }),
  ],
});
