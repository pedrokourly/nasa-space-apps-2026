import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Worker as an ES module (the default iife format does not support the code-splitting build).
  worker: { format: 'es' },
})
