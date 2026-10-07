import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: '/NavyaAdmissionPortal/',

    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg', 'manifest.json'],
        manifest: {
          id: '/NavyaAdmissionPortal/',
          name: 'NVEA Online Admission Portal',
          short_name: 'NVEA Portal',
          description: "NVEA's Official Admission Portal for prospective students to apply for enrollment and track their application status online.",
          theme_color: '#0F2942',
          background_color: '#0F2942',
          display: 'standalone',
          start_url: '/NavyaAdmissionPortal/',
          scope: '/NavyaAdmissionPortal/',
          icons: [
            {
              src: '/NavyaAdmissionPortal/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/NavyaAdmissionPortal/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/NavyaAdmissionPortal/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
