import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      maximumFileSizeToCacheInBytes: 3000000,
      manifest: {
        name: 'Shimaya Rutas',
        short_name: 'Rutas',
        theme_color: '#E50914',
        background_color: '#000000',
        display: 'fullscreen',
        start_url: '/',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        dontCacheBustURLsMatching: /.*/,
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  build: {
    rollupOptions: {
      external: ['canvg'],
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui': ['lucide-react', 'date-fns'],
          'charts': ['recharts'],
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['jspdf']
  }
})
