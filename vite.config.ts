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
      tailwindcss(), // Garante que o CSS (Tailwind) seja compilado no build
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          // Aumenta o limite para 25MB para suportar os vídeos do HUD e backgrounds
          maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
          
          // Resolve o erro de conexão do Firestore e Service Worker interceptor
          navigateFallbackDenylist: [/^\/__/, /firestore\.googleapis\.com/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/firestore\.googleapis\.com.*/,
              handler: 'NetworkOnly',
            },
          ],
          // Garante que os novos mapas (.webp) e os vídeos (.mp4) entrem no cache
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
      // Mantido em 1000 para acomodar o bundle do Firebase e assets
      chunkSizeWarningLimit: 1000,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});