import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// Cesium loads its web workers, widgets and assets at runtime from `CESIUM_BASE_URL`
// (set to `/cesium/` in `src/three-d/cesiumBase.ts`), so they are copied as plain static files.
const CESIUM_BUILD = 'node_modules/cesium/Build/Cesium'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: ['Workers', 'ThirdParty', 'Assets', 'Widgets'].map((dir) => ({
        src: `${CESIUM_BUILD}/${dir}`,
        dest: 'cesium',
        // Drop `node_modules/cesium/Build/Cesium/` so the files land at `cesium/Workers/…`.
        rename: { stripBase: 4 },
      })),
    }),
  ],
  // Worker as an ES module (the default iife format does not support the code-splitting build).
  worker: { format: 'es' },
  // The lazy 3D chunk (CesiumJS) is about 4 MB on purpose; the main chunk stays small.
  build: { chunkSizeWarningLimit: 4500 },
})
