import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Weather-Schedule/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Weather-Schedule',
        short_name: 'Weather-Schedule',
        start_url: '/Weather-Schedule/',
        display: 'standalone',
        icons: [
          {
            src: '/Weather-Schedule/pwa-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/Weather-Schedule/pwa-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})
