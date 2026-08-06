// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  site: 'https://umkm.servatius.id',
  integrations: [
    react(),
    sitemap({
      filter: (page) =>
        !page.includes('/admin') &&
        !page.includes('/dashboard/') &&
        !page.includes('/masuk') &&
        !page.includes('/daftar') &&
        !page.includes('/lupa-sandi') &&
        !page.includes('/reset-sandi') &&
        !page.includes('/_/'),
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
