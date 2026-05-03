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
          
          // Impede o Service Worker de quebrar a conexão com o Firestore
          navigateFallbackDenylist: [/^\/__/, /firestore\.googleapis\.com/, /firebase\.googleapis\.com/, /identitytoolkit\.googleapis\.com/, /securetoken\.googleapis\.com/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/firestore\.googleapis\.com.*/,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/firebase\.googleapis\.com\/.*/,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\/.*/,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/securetoken\.googleapis\.com\/.*/,
              handler: 'NetworkOnly',
            },
          ],
          // Cache de assets estáticos
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,mp4}']
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
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