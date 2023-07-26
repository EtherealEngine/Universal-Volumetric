import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
  plugins: [
    react(),
    // mkcert()
  ],
  optimizeDeps: {
    exclude: ['@etherealengine/volumetric']
  },
  server: {
    fs: { allow: ['..'] },
    // https: true,
    port: 3000
  }
})
