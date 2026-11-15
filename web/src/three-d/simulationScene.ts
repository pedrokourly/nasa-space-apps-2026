import {
  ArcType,
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Color,
  ConstantPositionProperty,
  ConstantProperty,
  CustomDataSource,
  HeadingPitchRange,
  HorizontalOrigin,
  LabelStyle,
  Math as CesiumMath,
  Matrix4,
  PolylineOutlineMaterialProperty,
  VerticalOrigin,
  type Entity,
} from 'cesium'
import type { LonLat } from '../lib/mars-geo'
import type { SimPath, SimulationState } from '../routing/simulation'
import type { MarsScene } from './marsViewer'
import { COLOR_RETURN_HABITAT, COLOR_RETURN_START, placeAt, type DrawnScene } from './routeScene'

/** Meters (before exaggeration) the walked line and the astronaut float above the surface. */
const WALKED_LIFT_M = 2.5
const ASTRONAUT_LIFT_M = 4
/** Bright yellow with a dark outline, so it reads apart from the green route and the amber way home. */
export const COLOR_WALKED = '#ffe14d'
const WALKED_COLOR = COLOR_WALKED
const PNR_COLOR = '#ff3b30'
/** Camera distance (m) and pitch while following the astronaut. */
const FOLLOW_RANGE_M = 2200
const FOLLOW_PITCH_DEG = -35

export interface SimOverlay {
  /** Moves the astronaut and the walked line; hides everything when `snap` is `null`. */
  update: (path: SimPath | null, snap: SimulationState | null, follow: boolean) => void
  /** Removes the overlay and releases the camera. Safe to call twice. */
  dispose: () => void
}

/** Height under `lonlat`, linearly interpolated between the sampled heights of vertices `i` and `i + 1`. */
function heightAlong(path: SimPath, i: number, lonlat: LonLat, drawn: DrawnScene): number {
  const a = path.coordinates[i]
  if (!a) return drawn.heightOf(lonlat)
  const ha = drawn.heightOf(a)
  const b = path.coordinates[i + 1]
  if (!b) return ha
  const hb = drawn.heightOf(b)
  const seg = Math.hypot(b[0] - a[0], b[1] - a[1])
  const f = seg > 0 ? Math.min(1, Math.hypot(lonlat[0] - a[0], lonlat[1] - a[1]) / seg) : 0
  return ha + (hb - ha) * f
}

function flag(ds: CustomDataSource, text: string, fill: string, color: string): Entity {
  return ds.entities.add({
    show: false,
    position: new ConstantPositionProperty(Cartesian3.ZERO),
    label: {
      text,
      font: '700 13px system-ui, sans-serif',
      fillColor: Color.fromCssColorString(color),
      outlineColor: Color.fromCssColorString('#0b0d12'),
      outlineWidth: 4,
      style: LabelStyle.FILL_AND_OUTLINE,
      showBackground: true,
      backgroundColor: Color.fromCssColorString(fill).withAlpha(0.9),
      horizontalOrigin: HorizontalOrigin.LEFT,
      verticalOrigin: VerticalOrigin.BOTTOM,
      pixelOffset: new Cartesian2(10, -26),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })
}

/**
 * EVA simulation in 3D (same plan, clock and snapshot as the 2D `SimulationLayer`): the walked part
 * of the path, the astronaut and the point-of-no-return / turn-back flags, placed on the exaggerated
 * relief. Heights come from the route scene's sampled vertices, interpolated in between.
 */
export function createSimOverlay(scene: MarsScene, drawn: DrawnScene): SimOverlay {
  const { viewer } = scene
  const ds = new CustomDataSource('simulation-3d')
  void viewer.dataSources.add(ds)

  let walked: Cartesian3[] = []
  let following = false

  const walkedLine = ds.entities.add({
    show: false,
    polyline: {
      positions: new CallbackProperty(() => walked, false),
      width: 10,
      arcType: ArcType.NONE,
      material: new PolylineOutlineMaterialProperty({
        color: Color.fromCssColorString(WALKED_COLOR),
        outlineColor: Color.fromCssColorString('#0b0d12'),
        outlineWidth: 2,
      }),
      depthFailMaterial: Color.fromCssColorString(WALKED_COLOR).withAlpha(0.35),
    },
  })
  const astronautPos = new ConstantPositionProperty(Cartesian3.ZERO)
  const astronaut = ds.entities.add({
    show: false,
    position: astronautPos,
    point: {
      pixelSize: 16,
      color: Color.fromCssColorString(WALKED_COLOR),
      outlineColor: Color.fromCssColorString('#0b0d12'),
      outlineWidth: 3,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: 'Astronaut',
      font: '600 12px system-ui, sans-serif',
      fillColor: Color.WHITE,
      outlineColor: Color.fromCssColorString('#0b0d12'),
      outlineWidth: 4,
      style: LabelStyle.FILL_AND_OUTLINE,
      horizontalOrigin: HorizontalOrigin.LEFT,
      verticalOrigin: VerticalOrigin.CENTER,
      pixelOffset: new Cartesian2(14, 0),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })
  const pnrFlag = flag(ds, 'Passed point of no return', PNR_COLOR, '#ffffff')
  const returnFlag = flag(ds, 'Returning', '#1a1f2b', COLOR_RETURN_HABITAT)

  const release = () => {
    if (following && !viewer.isDestroyed()) viewer.camera.lookAtTransform(Matrix4.IDENTITY)
    following = false
  }

  const at = (path: SimPath, i: number | undefined): Cartesian3 | undefined => {
    const c = i === undefined ? undefined : path.coordinates[i]
    return c ? placeAt(c, drawn.heightOf(c), drawn.matrix, ASTRONAUT_LIFT_M) : undefined
  }

  return {
    update(path, snap, follow) {
      if (viewer.isDestroyed()) return
      if (!path || !snap) {
        walkedLine.show = astronaut.show = pnrFlag.show = returnFlag.show = false
        walked = []
        release()
        return
      }
      const i = snap.vertexIndex
      const here = placeAt(snap.lonlat, heightAlong(path, i, snap.lonlat, drawn), drawn.matrix, ASTRONAUT_LIFT_M)
      walked = path.coordinates
        .slice(0, i + 1)
        .map((c) => placeAt(c, drawn.heightOf(c), drawn.matrix, WALKED_LIFT_M))
      walked.push(placeAt(snap.lonlat, heightAlong(path, i, snap.lonlat, drawn), drawn.matrix, WALKED_LIFT_M))
      walkedLine.show = walked.length >= 2
      astronautPos.setValue(here)
      astronaut.show = true

      const pnr = snap.pastPointOfNoReturn ? at(path, path.pnr_vertex) : undefined
      if (pnr) (pnrFlag.position as ConstantPositionProperty).setValue(pnr)
      pnrFlag.show = !!pnr

      const turn = snap.returning ? at(path, path.return_start_vertex) : undefined
      if (turn) {
        ;(returnFlag.position as ConstantPositionProperty).setValue(turn)
        const toStart = path.plan === 'start'
        returnFlag.label!.text = new ConstantProperty(toStart ? 'Returning to start' : 'Returning to habitat')
        returnFlag.label!.fillColor = new ConstantProperty(
          Color.fromCssColorString(toStart ? COLOR_RETURN_START : COLOR_RETURN_HABITAT),
        )
      }
      returnFlag.show = !!turn

      if (follow) {
        viewer.camera.lookAt(
          here,
          new HeadingPitchRange(
            following ? viewer.camera.heading : 0,
            CesiumMath.toRadians(FOLLOW_PITCH_DEG),
            FOLLOW_RANGE_M,
          ),
        )
        following = true
      } else {
        release()
      }
    },
    dispose() {
      release()
      if (!viewer.isDestroyed()) viewer.dataSources.remove(ds, true)
    },
  }
}
