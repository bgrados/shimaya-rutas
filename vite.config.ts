import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
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
        // IMPORTANTE: Los archivos icon-192x192.png e icon-512x512.png
        // deben generarse y colocarse en /public/ antes del build.
        // Herramienta recomendada: https://www.pwabuilder.com/imageGenerator
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
        // Cachea el shell de la app
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Estrategia de red con fallback a caché para requests de navegación
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Cache para assets estáticos (imágenes, fuentes)
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60, // 5 minutos
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 días
              },
            },
          },
          {
            urlPattern: /^https:\/\/{s}\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 días
              },
            },
          },
        ],
      },
    })
  ],
})
