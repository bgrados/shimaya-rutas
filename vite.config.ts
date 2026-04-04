import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Shimaya Rutas',
        short_name: 'Rutas',
        theme_color: '#E50914',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html}'],
        dontCacheBustURLsMatching: /.*/,
      },
      devOptions: {
        enabled: false
      }
    })
  ],
})
