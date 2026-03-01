import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase', expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 } },
          },
        ],
      },
      manifest: {
        name: 'Mileage Tracker Pro',
        short_name: 'MileagePro',
        description: 'IRS-proof mileage & trip tracking with Tesla integration',
        theme_color: '#0f172a',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: true },
      buildBase: '/',
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 5174,
    proxy: {
      '/api/tesla-fleet': {
        target: 'https://fleet-api.prd.na.vn.cloud.tesla.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tesla-fleet/, ''),
      },
      '/api/tesla-auth': {
        target: 'https://fleet-auth.prd.vn.cloud.tesla.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tesla-auth/, ''),
      },
      '/api/tesla-auth-consumer': {
        target: 'https://auth.tesla.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tesla-auth-consumer/, ''),
      },
    },
  },
})
