import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  optimizeDeps: {
    include: ['react-is', 'recharts', 'd3-geo', 'topojson-client', 'd3-zoom', 'd3-selection'],
  },
})
