import {
  ArcType,
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  ColorMaterialProperty,
  CustomDataSource,
  Ellipsoid,
  HeadingPitchRange,
  HorizontalOrigin,
  LabelStyle,
  Math as CesiumMath,
  Matrix4,
  PolylineDashMaterialProperty,
  PolylineGlowMaterialProperty,
  Transforms,
  VerticalOrigin,
} from 'cesium'
import type { LonLat } from '../lib/mars-geo'
import type { Route, TargetsCollection } from '../types/contract'
import {
  AOI_CENTER,
  MSG_NO_DEPTH,
  SceneError,
  VERTICAL_EXAGGERATION,
  type MarsScene,
} from './marsViewer'
import {
  SLOPE_COLORS,
  classifySlope,
  fillMissingHeights,
  groupSlopeRuns,
  segmentSlopesDeg,
} from './routeSlope'

export interface SceneInput {
  route: Route | null
  waypoints: readonly LonLat[]
  targets: TargetsCollection | null
}

export interface DrawnScene {
  /** Removes everything this call added to the viewer. Safe to call twice. */
  dispose: () => void
  /** Vertical exaggeration applied to the tileset; every overlay must be placed through it. */
  matrix: Matrix4
  /** Raw surface height (m) at a sampled point; falls back to the height at the center of the area. */
  heightOf: (lonlat: LonLat) => number
}

/** Meters the route floats above the surface (before exaggeration), so it does not z-fight with the mesh. */
const ROUTE_LIFT_M = 1.5
/** Meters markers float above the surface (before exaggeration). */
const MARKER_LIFT_M = 2
const ROUTE_WIDTH_PX = 9
const CAMERA_PITCH_DEG = -25
const MIN_RANGE_M = 600

const COLOR_START = '#00e5ff'
const COLOR_STOP = '#ffffff'
const COLOR_PNR = '#ff3b3b'
const COLOR_TARGET = '#ffb454'
/** Same colors as the 2D map (`map/RouteLayer.tsx`): amber way home to the habitat, violet way back to the start. */
export const COLOR_RETURN_HABITAT = '#ffb300'
export const COLOR_RETURN_START = '#c084fc'
const RETURN_WIDTH_PX = 5

interface Pt {
  lonlat: LonLat
  /** Raw surface height (m, above the Mars ellipsoid). */
  height: number
}

/**
 * Vertical exaggeration as a matrix: stretches space by `VERTICAL_EXAGGERATION` along the local "up"
 * of `origin`. It is applied to the tileset's `modelMatrix` and to every point drawn over it, so the
 * route always sits exactly on the stretched surface. (Cesium's `scene.verticalExaggeration` is not used:
 * with this Mars tileset it pushes the whole terrain tens of kilometers away from the camera.)
 */
function exaggerationMatrix(origin: Cartesian3): Matrix4 {
  const enu = Transforms.eastNorthUpToFixedFrame(origin, Ellipsoid.MARS)
  const stretch = Matrix4.fromScale(new Cartesian3(1, 1, VERTICAL_EXAGGERATION), new Matrix4())
  const inverse = Matrix4.inverseTransformation(enu, new Matrix4())
  return Matrix4.multiply(enu, Matrix4.multiply(stretch, inverse, new Matrix4()), new Matrix4())
}

/** World position of a surface point lifted by `lift` meters, then exaggerated by `matrix`. */
export function placeAt(lonlat: LonLat, height: number, matrix: Matrix4, lift: number): Cartesian3 {
  const raw = Cartesian3.fromDegrees(lonlat[0], lonlat[1], height + lift, Ellipsoid.MARS)
  return Matrix4.multiplyByPoint(matrix, raw, new Cartesian3())
}

function place(p: Pt, matrix: Matrix4, lift: number): Cartesian3 {
  return placeAt(p.lonlat, p.height, matrix, lift)
}

function labelStyle(text: string, color: string, fontPx: number) {
  return {
    text,
    font: `600 ${fontPx}px system-ui, sans-serif`,
    fillColor: Color.fromCssColorString(color),
    outlineColor: Color.fromCssColorString('#0b0d12'),
    outlineWidth: 4,
    style: LabelStyle.FILL_AND_OUTLINE,
    horizontalOrigin: HorizontalOrigin.LEFT,
    verticalOrigin: VerticalOrigin.BOTTOM,
    pixelOffset: new Cartesian2(10, -8),
    // Always readable, even behind a ridge.
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  }
}

function addMarker(
  ds: CustomDataSource,
  position: Cartesian3,
  text: string,
  color: string,
  sizePx: number,
  fontPx: number,
) {
  ds.entities.add({
    position,
    point: {
      pixelSize: sizePx,
      color: Color.fromCssColorString(color),
      outlineColor: Color.fromCssColorString('#0b0d12'),
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: labelStyle(text, color, fontPx),
  })
}

export const heightKey =([lon, lat]: LonLat): string => `${lon},${lat}`

/** Resolves after `n` rendered frames (or after 1.5 s if the page is not rendering, e.g. a hidden tab). */
function frames(scene: MarsScene, n: number): Promise<void> {
  return new Promise((resolve) => {
    let seen = 0
    const timer = window.setTimeout(done, 1500)
    const remove = scene.viewer.scene.postRender.addEventListener(() => {
      if (++seen >= n) done()
    })
    function done() {
      window.clearTimeout(timer)
      remove()
      resolve()
    }
  })
}

/**
 * Surface height (m above the Mars ellipsoid) under each point, `undefined` where it could not be read.
 * Cesium's height sampling must see the raw surface, so the exaggeration is lifted just for the lookup and
 * restored right after. Results are cached, so a redraw only samples points it has not seen.
 */
async function sampleHeights(
  scene: MarsScene,
  lonlats: readonly LonLat[],
): Promise<(number | undefined)[]> {
  const { viewer, tileset, heightCache } = scene
  const missing = lonlats.filter((p) => !heightCache.has(heightKey(p)))
  if (missing.length > 0) {
    const before = Matrix4.clone(tileset.modelMatrix)
    tileset.modelMatrix = Matrix4.IDENTITY
    try {
      await frames(scene, 2)
      const res = await viewer.scene.sampleHeightMostDetailed(
        missing.map(([lon, lat]) => Cartographic.fromDegrees(lon, lat)),
      )
      missing.forEach((p, i) => {
        const h = res[i]?.height
        if (h !== undefined && Number.isFinite(h)) heightCache.set(heightKey(p), h)
      })
    } finally {
      if (!viewer.isDestroyed()) tileset.modelMatrix = before
    }
  }
  return lonlats.map((p) => heightCache.get(heightKey(p)))
}

/**
 * Reads the terrain height under every point, draws the route (colored by slope), the markers
 * and the targets on top of the relief, and moves the camera to them. Everything is read-only
 * with respect to the store. Resolves to `null` when `isCancelled()` turned true while sampling.
 */
export async function drawRouteScene(
  scene: MarsScene,
  input: SceneInput,
  isCancelled: () => boolean,
): Promise<DrawnScene | null> {
  const { viewer, tileset } = scene
  if (!viewer.scene.sampleHeightSupported) throw new SceneError(MSG_NO_DEPTH)

  const coords = (input.route?.geometry.coordinates ?? []).map((c): LonLat => [c[0], c[1]])
  const wp = input.waypoints
  const targets = input.targets?.features ?? []
  const toLonLats = (c: readonly (readonly number[])[] | undefined): LonLat[] =>
    (c ?? []).map((p): LonLat => [p[0]!, p[1]!])
  const homeCoords = toLonLats(input.route?.properties.return_path?.coordinates)
  const startCoords = toLonLats(input.route?.properties.return_to_start?.return_path?.coordinates)

  // One batch: [AOI center, route vertices, waypoints, targets, way home, way back to the start].
  const lonlats: LonLat[] = [
    AOI_CENTER,
    ...coords,
    ...wp,
    ...targets.map((f) => f.geometry.coordinates as LonLat),
    ...homeCoords,
    ...startCoords,
  ]
  const sampled = await sampleHeights(scene, lonlats)
  if (isCancelled() || viewer.isDestroyed()) return null

  const heights = fillMissingHeights(sampled)
  if (!heights) throw new SceneError('Could not read the terrain height. Try again in a moment.')
  const pts: Pt[] = lonlats.map((lonlat, i) => ({ lonlat, height: heights[i]! }))

  const centerPt = pts[0]!
  const routePts = pts.slice(1, 1 + coords.length)
  const wpPts = pts.slice(1 + coords.length, 1 + coords.length + wp.length)
  const targetEnd = 1 + coords.length + wp.length + targets.length
  const targetPts = pts.slice(1 + coords.length + wp.length, targetEnd)
  const homePts = pts.slice(targetEnd, targetEnd + homeCoords.length)
  const startPts = pts.slice(targetEnd + homeCoords.length)
  // Gaps were filled above; cache the filled heights too so the simulation overlay reuses them.
  for (const p of pts) {
    const key = heightKey(p.lonlat)
    if (!scene.heightCache.has(key)) scene.heightCache.set(key, p.height)
  }

  // Exaggerate around the terrain height at the center of the area, so the scene does not sink or rise.
  const matrix = exaggerationMatrix(
    Cartesian3.fromDegrees(AOI_CENTER[0], AOI_CENTER[1], centerPt.height, Ellipsoid.MARS),
  )
  tileset.modelMatrix = matrix

  const ds = new CustomDataSource('route-3d')
  void viewer.dataSources.add(ds)

  // Route, colored by local slope per segment.
  if (routePts.length >= 2) {
    const slopes = segmentSlopesDeg(
      routePts.map((p) => p.lonlat),
      routePts.map((p) => p.height),
    )
    const runs = groupSlopeRuns(slopes.map(classifySlope))
    for (const run of runs) {
      const color = Color.fromCssColorString(SLOPE_COLORS[run.cls])
      ds.entities.add({
        polyline: {
          positions: routePts
            .slice(run.from, run.to + 1)
            .map((p) => place(p, matrix, ROUTE_LIFT_M)),
          width: ROUTE_WIDTH_PX,
          arcType: ArcType.NONE,
          material: new PolylineGlowMaterialProperty({ glowPower: 0.25, taperPower: 1, color }),
          // Hidden parts stay faintly visible behind ridges.
          depthFailMaterial: new ColorMaterialProperty(color.withAlpha(0.3)),
        },
      })
    }
  }

  // Estimated ways back: dashed amber to the habitat, short-dashed violet to the start (as in 2D).
  const addReturn = (line: Pt[], color: string, dashLength: number) => {
    if (line.length < 2) return
    const c = Color.fromCssColorString(color)
    ds.entities.add({
      polyline: {
        positions: line.map((p) => place(p, matrix, ROUTE_LIFT_M)),
        width: RETURN_WIDTH_PX,
        arcType: ArcType.NONE,
        material: new PolylineDashMaterialProperty({ color: c, gapColor: Color.TRANSPARENT, dashLength }),
        depthFailMaterial: new ColorMaterialProperty(c.withAlpha(0.3)),
      },
    })
  }
  addReturn(homePts, COLOR_RETURN_HABITAT, 18)
  addReturn(startPts, COLOR_RETURN_START, 8)

  // Targets (small pins), then route markers on top.
  targets.forEach((f, i) => {
    addMarker(
      ds,
      place(targetPts[i]!, matrix, MARKER_LIFT_M),
      f.properties.name,
      COLOR_TARGET,
      8,
      12,
    )
  })
  wpPts.forEach((p, i) => {
    const isStart = i === 0
    addMarker(
      ds,
      place(p, matrix, MARKER_LIFT_M),
      isStart ? 'Start' : `Stop ${i}`,
      isStart ? COLOR_START : COLOR_STOP,
      13,
      14,
    )
  })
  const pnrIdx = input.route?.properties.point_of_no_return
  const pnr = pnrIdx === undefined ? undefined : routePts[pnrIdx]
  if (pnr) addMarker(ds, place(pnr, matrix, MARKER_LIFT_M), 'Point of no return', COLOR_PNR, 15, 14)

  // Camera: oblique view of the route, or of the area of interest when there is no route.
  // The ways back are framed too, with room for the legend and the EVA panel on the sides.
  const focus = routePts.length >= 2 ? [...routePts, ...homePts, ...startPts] : [centerPt]
  const sphere = BoundingSphere.fromPoints(focus.map((p) => place(p, matrix, 0)))
  const range = routePts.length >= 2 ? Math.max(sphere.radius * 3.2, MIN_RANGE_M) : 6000
  viewer.camera.flyToBoundingSphere(sphere, {
    offset: new HeadingPitchRange(0, CesiumMath.toRadians(CAMERA_PITCH_DEG), range),
    duration: scene.hasFlown ? 1.5 : 0,
  })
  scene.hasFlown = true

  return {
    dispose: () => {
      if (!viewer.isDestroyed()) viewer.dataSources.remove(ds, true)
    },
    matrix,
    heightOf: (lonlat) => scene.heightCache.get(heightKey(lonlat)) ?? centerPt.height,
  }
}
