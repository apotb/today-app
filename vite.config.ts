import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['27b7-2603-6011-2df0-3740-e1a4-d4da-f1ec-7814.ngrok-free.app']
  },
})
