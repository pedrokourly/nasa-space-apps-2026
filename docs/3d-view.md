# 3D view

The 3D view shows the current route over the real relief of Jezero. It is read-only: it reads `route`, `waypoints` and the targets from the store and never edits them. Code: `web/src/three-d/`.

## Sources

- **Relief:** Cesium Mars 3D Tiles, from Cesium ion (asset `3644333`, override with `VITE_CESIUM_MARS_ASSET_ID`). Attribution reported by Cesium ion: NASA, ESA, and the USGS Astrogeology Science Center.
- **Library:** [CesiumJS](https://cesium.com/platform/cesiumjs/) 1.147.0, Apache-2.0.
- **Token:** `VITE_CESIUM_ION_TOKEN` (never committed; set it as a build variable in the deploy).

## Behavior

- Cesium is loaded lazily (its own chunk), only when the user switches to the 3D view. Its static files (`Workers`, `ThirdParty`, `Assets`, `Widgets`) are copied to `/cesium/` by `vite.config.ts`.
- Mars ellipsoid (`Ellipsoid.MARS`); no Earth globe, imagery or atmosphere.
- The surface height under every route vertex is read from the tileset (`sampleHeightMostDetailed`), so the route hugs the relief. The route `profile` elevations are not used for placement (different vertical datum).
- The route is colored per segment by slope computed from those heights and the haversine distance with the Mars radius (`routeSlope.ts`).

## Assumptions

- **Slope colors** (green below 10°, amber 10° to 20°, red above 20°) are a visualization choice, not a safety limit. The routing cost function is separate (`web/src/routing/`).
- **Vertical exaggeration 3×** is applied as a stretch along the local vertical to the tileset and to everything drawn over it. Cesium's `scene.verticalExaggeration` is not used because it displaces this Mars tileset by tens of kilometers.
- **Sun direction** is fixed (west-southwest, 30° above the horizon) to make the relief readable; it is not the real illumination at any date.
