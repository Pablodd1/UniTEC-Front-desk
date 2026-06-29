
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve('./'),
    },
  },
  server: { proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } } },
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || process.env.VITE_API_KEY || ""),
    'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_API_KEY || ""),
    'process.env.OPENROUTER_API_KEY': JSON.stringify(process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || "")
  }
})


