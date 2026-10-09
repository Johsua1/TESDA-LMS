import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // <-- Add this line to activate Tailwind
  ],
  server: {
    port: 5173,
    open: true,
  },
})