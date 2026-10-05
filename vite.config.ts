import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['logo_letra_n.png', 'logo_nome_horizontal.png'],
      manifest: {
        name: 'Nexo — Finanças pessoais',
        short_name: 'Nexo',
        description: 'Suas anotações financeiras, com clareza.',
        start_url: '.',
        display: 'standalone',
        background_color: '#f4f7f6',
        theme_color: '#192b25',
        icons: [{ src: 'logo_letra_n.png', sizes: 'any', type: 'image/png', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallbackDenylist: [/^\/functions\//, /^\/auth\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
      },
    }),
  ],
  base: process.env.VITE_BASE_PATH || '/',
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['shared/financial-engine.ts'],
      thresholds: { statements: 85, branches: 75, functions: 90, lines: 85 },
    },
  },
});
