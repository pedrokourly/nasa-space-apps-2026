import './cesiumBase'
import {
  Cartesian3,
  Cesium3DTileset,
  Color,
  DirectionalLight,
  Ellipsoid,
  Ion,
  Math as CesiumMath,
  Matrix4,
  Transforms,
  Viewer,
} from 'cesium'
import type { LonLat } from '../lib/mars-geo'

/** Cesium ion asset "Cesium Mars" (3D Tiles). Override with `VITE_CESIUM_MARS_ASSET_ID`. */
export const DEFAULT_MARS_ASSET_ID = 3644333

/** Vertical exaggeration applied to the terrain and to everything drawn over it. */
export const VERTICAL_EXAGGERATION = 3

/** Center of the Jezero area of interest, `[lon, lat]`. */
export const AOI_CENTER: LonLat = [77.43, 18.45]

export const MSG_MARS_UNAVAILABLE =
  'Cesium Mars is not available for this ion token. Add it from the Cesium ion Asset Depot.'
export const MSG_NO_TOKEN =
  'Cesium ion token is missing. Set VITE_CESIUM_ION_TOKEN to see the 3D view.'
export const MSG_NO_DEPTH =
  'This browser or GPU cannot read the terrain height, so the route cannot be placed in 3D.'

/** Error with a message that is safe to show to the user. */
export class SceneError extends Error {}

export interface MarsScene {
  viewer: Viewer
  tileset: Cesium3DTileset
  /** `true` once the camera has been placed at least once. */
  hasFlown: boolean
  /** Surface heights already read, keyed by `lon,lat` (see `routeScene.ts`). */
  heightCache: Map<string, number>
}

function assetId(): number {
  const raw = Number(import.meta.env.VITE_CESIUM_MARS_ASSET_ID)
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_MARS_ASSET_ID
}

/**
 * Creates a Cesium viewer set up for Mars: Mars ellipsoid, no Earth globe, no Earth imagery,
 * no sky atmosphere, dark background, and the Cesium Mars 3D Tiles from Cesium ion.
 * Throws {@link SceneError} (with a user-facing message) when the tileset cannot be loaded.
 * Nothing is created if `isCancelled()` turns true while loading.
 */
export async function createMarsScene(
  container: HTMLElement,
  isCancelled: () => boolean,
): Promise<MarsScene> {
  const token = import.meta.env.VITE_CESIUM_ION_TOKEN
  if (!token) throw new SceneError(MSG_NO_TOKEN)
  Ion.defaultAccessToken = token

  // Must be set before the viewer exists so the scene's map projection and camera use Mars.
  Ellipsoid.default = Ellipsoid.MARS

  let tileset: Cesium3DTileset
  try {
    tileset = await Cesium3DTileset.fromIonAssetId(assetId(), {
      ellipsoid: Ellipsoid.MARS,
      maximumScreenSpaceError: 8,
    })
  } catch (e) {
    console.error('Cesium Mars failed to load', e)
    throw new SceneError(MSG_MARS_UNAVAILABLE)
  }
  if (isCancelled()) {
    tileset.destroy()
    throw new SceneError('cancelled')
  }

  const viewer = new Viewer(container, {
    baseLayer: false,
    globe: false,
    skyAtmosphere: false,
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    shouldAnimate: false,
  })
  const { scene } = viewer
  scene.backgroundColor = Color.fromCssColorString('#0b0d12')
  if (scene.sun) scene.sun.show = false
  if (scene.moon) scene.moon.show = false
  scene.highDynamicRange = false
  scene.primitives.add(tileset)

  // Earth's sun position would light Mars at random, so use a fixed low sun (WSW, 30° up) at Jezero.
  // A low sun throws long shadows-like shading that makes the relief readable.
  const origin = Cartesian3.fromDegrees(AOI_CENTER[0], AOI_CENTER[1], 0, Ellipsoid.MARS)
  const enu = Transforms.eastNorthUpToFixedFrame(origin, Ellipsoid.MARS)
  const az = CesiumMath.toRadians(250)
  const el = CesiumMath.toRadians(30)
  const toSun = new Cartesian3(
    Math.cos(el) * Math.sin(az),
    Math.cos(el) * Math.cos(az),
    Math.sin(el),
  )
  const direction = Matrix4.multiplyByPointAsVector(
    enu,
    Cartesian3.negate(toSun, new Cartesian3()),
    new Cartesian3(),
  )
  scene.light = new DirectionalLight({ direction: Cartesian3.normalize(direction, direction) })

  return { viewer, tileset, hasFlown: false, heightCache: new Map() }
}

/** Destroys the viewer (and with it the tileset and every WebGL resource). Safe to call twice. */
export function destroyMarsScene(s: MarsScene): void {
  if (!s.viewer.isDestroyed()) s.viewer.destroy()
}
