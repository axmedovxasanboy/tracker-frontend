import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Allow access through dev tunnels (ngrok / cloudflared) so the Telegram Web App can
    // load the frontend over HTTPS. A leading dot matches all subdomains, so rotating
    // ngrok URLs keep working without re-editing this.
    allowedHosts: ['.ngrok-free.app', '.ngrok.app', '.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/actuator': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
