import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'; 
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          // Aumenta o limite para 25MB para suportar vídeos e mapas
          maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,

          // Desativa Navigation Preload — evita interceptação de requests de navegação
          // que o Workbox confunde com fetch de dados do Firestore
          navigationPreload: false,

          /**
           * REGRAS DE CACHE EM TEMPO DE EXECUÇÃO
           *
           * ORDEM IMPORTA: o Workbox usa o primeiro match que encontrar.
           *
           * Cobre:
           *  - Avatar do Discord (NetworkFirst)
           */
          runtimeCaching: [
            // ── Discord CDN (avatares) — NetworkFirst ─────────────────────
            {
              urlPattern: /^https:\/\/cdn\.discordapp\.com\/.*/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'discord-avatars',
                networkTimeoutSeconds: 5,
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 dias
                },
              },
            },
          ],

          // Padrões de pré-cache (assets do build)
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,mp4}'],

          /**
           * navigateFallbackDenylist:
           * Impede o SW de interceptar chamadas de navegação
           * para os domínios do Firebase.
           */
          navigateFallbackDenylist: [
            /^\/__/,
            /^https?:\/\/.*\.googleapis\.com/,
            /^https?:\/\/accounts\.google\.com/,
          ],
        },
        manifest: {
          name: 'Mythos Draft',
          short_name: 'Mythos Draft',
          description: 'Competitive drafting tool for Age of Mythology: Retold.',
          theme_color: '#020617',
          background_color: '#020617',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      }),
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 1000,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});