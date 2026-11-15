/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base comes from env so the same build works at a GitHub Pages sub-path or at root
// without code changes (repo name is not decided yet; the router is a HashRouter).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    css: false,
  },
});
