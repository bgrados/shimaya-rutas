import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo-shimaya.svg'],
      manifest: {
        name: 'Shimaya Rutas',
        short_name: 'Rutas',
        description: 'Gestión de rutas logísticas para conductores Shimaya',
        theme_color: '#E50914',
        background_color: '#000000',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        lang: 'es',
        orientation: 'portrait',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true,
        dontCacheBustURLsMatching: /./,
      },
      devOptions: {
        enabled: false
      }
    })
  ],
})
