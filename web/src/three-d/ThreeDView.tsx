import './cesiumBase'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../state/store'
import type { TargetsCollection } from '../types/contract'
import { SLOPE_COLORS, SLOPE_MODERATE_DEG, SLOPE_STEEP_DEG } from './routeSlope'
import {
  VERTICAL_EXAGGERATION,
  SceneError,
  createMarsScene,
  destroyMarsScene,
  type MarsScene,
} from './marsViewer'
import { drawRouteScene } from './routeScene'
import './ThreeDView.css'

interface Props {
  targets: TargetsCollection | null
}

function messageOf(e: unknown): string {
  return e instanceof SceneError
    ? e.message
    : 'The 3D view failed to start. Check the browser console.'
}

/**
 * 3D view of the route over the real relief of Jezero (Cesium + Cesium Mars). Read-only: it only
 * reads `route`, `waypoints` and the targets, it never edits them. Loaded lazily by `App`.
 */
export default function ThreeDView({ targets }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scene, setScene] = useState<MarsScene | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [settled, setSettled] = useState<{
    route: unknown
    waypoints: unknown
    targets: unknown
  } | null>(null)
  const route = useAppStore((s) => s.route)
  const waypoints = useAppStore((s) => s.waypoints)

  // Viewer lifecycle: created on mount, destroyed on unmount.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let cancelled = false
    let created: MarsScene | null = null
    createMarsScene(el, () => cancelled).then(
      (s) => {
        if (cancelled) destroyMarsScene(s)
        else {
          created = s
          setScene(s)
        }
      },
      (e: unknown) => {
        if (!cancelled) setError(messageOf(e))
      },
    )
    return () => {
      cancelled = true
      setScene(null)
      if (created) destroyMarsScene(created)
    }
  }, [])

  // Draws the route and the markers; redraws whenever the route, the stops or the targets change.
  useEffect(() => {
    if (!scene) return
    let cancelled = false
    let dispose: (() => void) | undefined
    drawRouteScene(scene, { route, waypoints, targets }, () => cancelled).then(
      (drawn) => {
        if (cancelled) {
          drawn?.dispose()
          return
        }
        dispose = drawn?.dispose
        setSettled({ route, waypoints, targets })
      },
      (e: unknown) => {
        if (cancelled) return
        console.error('3D route failed', e)
        setError(messageOf(e))
        setSettled({ route, waypoints, targets })
      },
    )
    return () => {
      cancelled = true
      dispose?.()
    }
  }, [scene, route, waypoints, targets])

  const drawing =
    !settled ||
    settled.route !== route ||
    settled.waypoints !== waypoints ||
    settled.targets !== targets
  const hasRoute = !!route && route.geometry.coordinates.length >= 2

  return (
    <div className="three-d">
      <div ref={containerRef} className="three-d__canvas" />
      {error ? (
        <div className="three-d__message" role="alert">
          {error}
        </div>
      ) : !scene ? (
        <div className="three-d__message">Loading Mars relief…</div>
      ) : (
        <>
          <aside className="three-d__legend" aria-label="3D view legend">
            <div className="three-d__legend-title">
              Vertical exaggeration {VERTICAL_EXAGGERATION}×
            </div>
            <div className="three-d__legend-row">
              <span className="three-d__swatch" style={{ background: SLOPE_COLORS.easy }} />
              {`Slope < ${SLOPE_MODERATE_DEG}°`}
            </div>
            <div className="three-d__legend-row">
              <span className="three-d__swatch" style={{ background: SLOPE_COLORS.moderate }} />
              {`${SLOPE_MODERATE_DEG}° to ${SLOPE_STEEP_DEG}°`}
            </div>
            <div className="three-d__legend-row">
              <span className="three-d__swatch" style={{ background: SLOPE_COLORS.steep }} />
              {`Slope > ${SLOPE_STEEP_DEG}°`}
            </div>
            <div className="three-d__legend-source">Relief: Cesium Mars (Cesium ion)</div>
          </aside>
          {!hasRoute && (
            <div className="three-d__hint">Draw a route on the 2D map to see it in 3D</div>
          )}
          {drawing && <div className="three-d__busy">Reading terrain heights…</div>}
        </>
      )}
    </div>
  )
}
