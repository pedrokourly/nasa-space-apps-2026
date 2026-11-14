/**
 * Side-effect module: tells Cesium where its static files (Workers, ThirdParty, Assets, Widgets) live.
 * Import it BEFORE anything that imports `cesium`. The files are copied to `/cesium/` by `vite.config.ts`.
 */
declare global {
  interface Window {
    CESIUM_BASE_URL?: string
  }
}

window.CESIUM_BASE_URL = `${import.meta.env.BASE_URL}cesium/`

export {}
