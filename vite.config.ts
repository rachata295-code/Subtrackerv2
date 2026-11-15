/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Keep equal to --ground in tokens.css (light theme) and the <meta name="theme-color"> in index.html:
// the install splash and the browser chrome use it before any CSS has loaded.
const GROUND_LIGHT = '#f3f5f7';

// base comes from env so the same build works at a GitHub Pages sub-path or at root
// without code changes (production: VITE_BASE=/Subtrackerv2/; the router is a HashRouter).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    react(),
    VitePWA({
      // autoUpdate: a new deploy replaces the cached shell on next load without a prompt (no update UI to design yet).
      registerType: 'autoUpdate',
      workbox: {
        // woff2 is listed on purpose: without it the self-hosted Anuphan/Manrope files are not precached and Thai
        // text falls back to a system font when the app is opened offline.
        globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
      },
      manifest: {
        name: 'SubTracker',
        short_name: 'SubTracker',
        description: 'ติดตามรายจ่ายประจำและเงินที่เหลือใช้',
        lang: 'th',
        display: 'standalone',
        theme_color: GROUND_LIGHT,
        background_color: GROUND_LIGHT,
        // Relative to the manifest, so the icons resolve under any VITE_BASE.
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: false,
    // CSS is stubbed for speed, except tokens.css, which DesignPage imports with ?raw to compute contrast ratios.
    css: { include: [/tokens\.css/] },
  },
});
