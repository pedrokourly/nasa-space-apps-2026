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
import {
  COLOR_RETURN_HABITAT,
  COLOR_RETURN_START,
  drawRouteScene,
  type DrawnScene,
} from './routeScene'
import { COLOR_WALKED, createSimOverlay, type SimOverlay } from './simulationScene'
import { useSimulationStore } from '../state/simulationStore'
import { useSimulationPath, useSimulationSnapshot } from '../routing/useSimulation'
import { Badge } from '../ui/kit'
import { ChevronDownIcon } from '../ui/icons'
import './ThreeDView.css'

interface Props {
  targets: TargetsCollection | null
  /** The camera follows the astronaut while the EVA runs (the "Follow astronaut" button in App). */
  follow: boolean
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
export default function ThreeDView({ targets, follow }: Props) {
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
  const [drawn, setDrawn] = useState<DrawnScene | null>(null)
  const [legendOpen, setLegendOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth > 800,
  )
  const overlayRef = useRef<SimOverlay | null>(null)
  const simStatus = useSimulationStore((s) => s.status)
  const simPath = useSimulationPath()
  const simSnap = useSimulationSnapshot()
  const simActive = simStatus !== 'idle' && simSnap !== null

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
        setDrawn(drawn)
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
      setDrawn(null)
      dispose?.()
    }
  }, [scene, route, waypoints, targets])

  // EVA simulation overlay: one per drawn scene (it needs the scene's exaggeration and heights).
  useEffect(() => {
    if (!scene || !drawn) return
    const overlay = createSimOverlay(scene, drawn)
    overlayRef.current = overlay
    return () => {
      overlayRef.current = null
      overlay.dispose()
    }
  }, [scene, drawn])

  // Moves the astronaut on every simulation frame, with the same plan and clock as the 2D map.
  useEffect(() => {
    overlayRef.current?.update(
      simActive ? simPath : null,
      simActive ? simSnap : null,
      follow && simStatus === 'running',
    )
  }, [drawn, simActive, simPath, simSnap, simStatus, follow])

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
          <aside
            className={`three-d__legend${legendOpen ? '' : ' three-d__legend--closed'}`}
            aria-label="3D view legend"
          >
            <button
              type="button"
              className="three-d__legend-head"
              aria-expanded={legendOpen}
              onClick={() => setLegendOpen((o) => !o)}
            >
              <span>3D route</span>
              <Badge variant="outline">Relief ×{VERTICAL_EXAGGERATION}</Badge>
              <span className={`three-d__chevron${legendOpen ? ' three-d__chevron--open' : ''}`}>
                <ChevronDownIcon />
              </span>
            </button>
            {legendOpen && (
              <div className="three-d__legend-body">
                <div className="three-d__legend-section">Route slope</div>
                <div className="three-d__slope-scale">
                  <span><i style={{ background: SLOPE_COLORS.easy }} />{`< ${SLOPE_MODERATE_DEG}°`}</span>
                  <span><i style={{ background: SLOPE_COLORS.moderate }} />{`${SLOPE_MODERATE_DEG}–${SLOPE_STEEP_DEG}°`}</span>
                  <span><i style={{ background: SLOPE_COLORS.steep }} />{`> ${SLOPE_STEEP_DEG}°`}</span>
                </div>
                {hasRoute && (
                  <>
                    {/* One list: the ways back (estimates) and the part of the EVA already walked. */}
                    <div className="three-d__legend-section">Ways back and EVA</div>
                    {route?.properties.return_path && (
                      <div className="three-d__legend-row">
                        <span className="three-d__swatch three-d__swatch--dashed" style={{ color: COLOR_RETURN_HABITAT }} />
                        To habitat (estimate)
                      </div>
                    )}
                    {route?.properties.return_to_start?.return_path && (
                      <div className="three-d__legend-row">
                        <span className="three-d__swatch three-d__swatch--dotted" style={{ color: COLOR_RETURN_START }} />
                        To start (estimate)
                      </div>
                    )}
                    <div className="three-d__legend-row">
                      <span className="three-d__swatch" style={{ background: COLOR_WALKED }} />
                      Walked so far
                    </div>
                  </>
                )}
                <div className="three-d__legend-source">Relief: Cesium Mars (Cesium ion)</div>
              </div>
            )}
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
