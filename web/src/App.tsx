import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { findHabitat, loadData, type AppData, type DataSources } from './lib/loadData'
import MapView from './map/MapView'
import TargetsLayer from './map/TargetsLayer'
import TargetCard from './ui/TargetCard'
import WaypointsLayer from './map/WaypointsLayer'
import PlanningAreaFocus from './map/PlanningAreaFocus'
import LayerManager from './map/LayerManager'
import SlopeLayer from './map/SlopeLayer'
import RouteController from './routing/RouteController'
import RouteLayer from './map/RouteLayer'
import RouteMarkers from './map/RouteMarkers'
import RouteSummary from './ui/RouteSummary'
import { RESERVE_NOTE } from './ui/reserveNote'
import SimulationLayer from './map/SimulationLayer'
import SimulationControl from './ui/SimulationControl'
import TileHealth from './map/TileHealth'
import TileLoading from './map/TileLoading'
import DataStatus from './ui/DataStatus'
import ViewToggle, { type ViewMode } from './ui/ViewToggle'
import { useAppStore } from './state/store'
import { useRouteHashSync } from './state/useRouteHashSync'
import { useSimulationPath, useSimulationSnapshot } from './routing/useSimulation'
import { useSimulationStore } from './state/simulationStore'
import { formatDistance, formatElapsed } from './ui/simulationFormat'
import { availablePlans, buildSimPath } from './routing/simulation'
import ProvenanceBadge, { Legend } from './ui/ProvenanceBadge'
import { LAYERS } from './map/layers'
import type { LayerId, Conditions } from './types/contract'
import MarsDataScreen from './ui/MarsDataScreen'
import { Button } from './ui/kit'
import { CloseIcon, InfoIcon, LayersIcon, LocateIcon, MaximizeIcon, NavigationIcon, RouteIcon, SlopeIcon, ThermometerIcon } from './ui/icons'
import './ui/PlannerShell.css'
import './ui/kit.css'

const ThreeDView = lazy(() => import('./three-d/ThreeDView'))
const DATA_SOURCES: DataSources = { meta: 'real', targets: 'real', missions: 'real' }
const JEZERO_OVERVIEW: L.LatLngTuple = [18.45, 77.43]

type AppTab = 'planning' | 'mars-data'
type ToolId = 'info'
const SOURCE_LAYERS: { id: LayerId; label: string; icon: 'elevation' | 'temperature' | 'slope' }[] = [
  { id: 'mola', label: 'MOLA elevation', icon: 'elevation' },
  { id: 'themis-dia', label: 'THEMIS temperature', icon: 'temperature' },
  { id: 'slope', label: 'HiRISE DTM slope', icon: 'slope' },
]

export default function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [latestSol, setLatestSol] = useState<number | null>(null)
  const [conditions, setConditions] = useState<Conditions | null>(null)
  const [view, setView] = useState<ViewMode>('2d')
  const [tab, setTab] = useState<AppTab>('planning')
  const [activeTool, setActiveTool] = useState<ToolId | null>(null)
  const [selectedSourceLayer, setSelectedSourceLayer] = useState<LayerId | null>(null)
  /** Top (px, inside the map area) of the layer button whose source panel is open: the panel opens beside it. */
  const [sourcePanelTop, setSourcePanelTop] = useState<number | null>(null)
  /** 3D view: the camera follows the astronaut during the EVA (toggled by "Follow astronaut"). */
  const [follow3d, setFollow3d] = useState(true)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)
  const [recenterIndicator, setRecenterIndicator] = useState({ centered: false, rotation: 0 })
  const route = useAppStore((state) => state.route)
  const waypoints = useAppStore((state) => state.waypoints)
  const activeLayers = useAppStore((state) => state.activeLayers)
  const selectedTargetId = useAppStore((state) => state.selectedTargetId)
  const selectTarget = useAppStore((state) => state.selectTarget)
  const toggleLayer = useAppStore((state) => state.toggleLayer)
  const simulationStatus = useSimulationStore((state) => state.status)
  const planningAreaCenter = useMemo(() => {
    const bbox = data?.meta.bbox
    return bbox
      ? [(bbox[1] + bbox[3]) / 2, (bbox[0] + bbox[2]) / 2] as L.LatLngTuple
      : JEZERO_OVERVIEW
  }, [data?.meta.bbox])
  useRouteHashSync()

  useEffect(() => {
    loadData(DATA_SOURCES).then(
      (d) => {
        setData(d)
        // The way home and the GO / NO-GO verdict are measured against the real habitat (#69).
        useAppStore.getState().setHabitat(findHabitat(d.targets))
      },
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    )
    fetch(`${import.meta.env.BASE_URL}data/conditions.json`).then((response) => {
      if (!response.ok) throw new Error('Conditions unavailable')
      return response.json() as Promise<Conditions>
    }).then((loadedConditions) => {
      setConditions(loadedConditions)
      setLatestSol(loadedConditions.latest_sol)
    }).catch(() => { setConditions(null); setLatestSol(null) })
  }, [])

  // Selecting a target closes the source panel. Adjusted during render (not in an effect) to avoid
  // an extra render pass.
  const [prevTargetId, setPrevTargetId] = useState(selectedTargetId)
  if (prevTargetId !== selectedTargetId) {
    setPrevTargetId(selectedTargetId)
    if (selectedTargetId) setSelectedSourceLayer(null)
  }

  useEffect(() => {
    if (!mapInstance) return
    const updateIndicator = () => {
      const target = mapInstance.latLngToContainerPoint(planningAreaCenter)
      const center = mapInstance.getSize().divideBy(2)
      const dx = target.x - center.x
      const dy = target.y - center.y
      const centered = Math.hypot(dx, dy) < 4
      setRecenterIndicator({
        centered,
        rotation: centered ? 0 : (Math.atan2(dy, dx) * 180) / Math.PI + 90,
      })
    }
    updateIndicator()
    mapInstance.on('move zoomend resize', updateIndicator)
    return () => {
      mapInstance.off('move zoomend resize', updateIndicator)
    }
  }, [mapInstance, planningAreaCenter])

  useEffect(() => {
    if (!mapInstance) return
    let resizeFrame = 0
    const invalidateMapSize = () => {
      window.cancelAnimationFrame(resizeFrame)
      resizeFrame = window.requestAnimationFrame(() => {
        mapInstance.invalidateSize({ pan: false, debounceMoveend: true })
      })
    }
    window.addEventListener('resize', invalidateMapSize)
    document.addEventListener('fullscreenchange', invalidateMapSize)
    return () => {
      window.cancelAnimationFrame(resizeFrame)
      window.removeEventListener('resize', invalidateMapSize)
      document.removeEventListener('fullscreenchange', invalidateMapSize)
    }
  }, [mapInstance])

  const selectedTarget = useMemo(
    () => data?.targets.features.find((feature) => feature.properties.id === selectedTargetId),
    [data, selectedTargetId],
  )

  const chooseTool = () => {
    setSelectedSourceLayer(null)
    selectTarget(null)
    if (activeTool === 'info') {
      setActiveTool(null)
    } else {
      setActiveTool('info')
    }
  }

  const recenterOnPlanningArea = () => {
    if (!mapInstance) return
    const bbox = data?.meta.bbox
    if (!bbox) {
      mapInstance.setView(planningAreaCenter, 10)
      return
    }
    const [minLon, minLat, maxLon, maxLat] = bbox
    const bounds = L.latLngBounds([minLat, minLon], [maxLat, maxLon])
    mapInstance.invalidateSize({ pan: false })
    const zoom = mapInstance.getBoundsZoom(bounds, false, L.point(48, 48))
    mapInstance.setView(planningAreaCenter, zoom, { animate: false })
  }

  const routeValues = route
    ? {
        distance: (route.properties.dist_m / 1000).toFixed(1),
        time: Math.round(route.properties.time_s / 60),
        oxygen: route.properties.o2_kg.toFixed(2),
        elevation: route.properties.profile.reduce((gain, point, index, profile) => {
          if (index === 0) return gain
          return gain + Math.max(0, point[1] - profile[index - 1][1])
        }, 0),
      }
    : null
  const panelTool = activeTool

  return (
    <div className="app">
      <header className="app-header">
        <a className="app-brand" href="#map-area" aria-label="Mars Route Planner home">
          <span className="app-brand__mark" aria-hidden="true"><svg className="mars-icon" viewBox="0 0 32 32"><defs><linearGradient id="marsSurface" x1="3" y1="5" x2="29" y2="28" gradientUnits="userSpaceOnUse"><stop stopColor="#ffb13b"/><stop offset=".52" stopColor="#ff641d"/><stop offset="1" stopColor="#c92b25"/></linearGradient><clipPath id="marsSurfaceClip"><circle cx="16" cy="16" r="14"/></clipPath></defs><circle className="mars-icon__planet" cx="16" cy="16" r="14"/><g clipPath="url(#marsSurfaceClip)" fill="#9f2028" opacity=".86"><path d="M-2 7c5-2 9-2 13 0 3 2 7 2 11 0 4-2 8-2 12 0v4c-5 2-9 2-13 0-3-2-7-2-11 0-4 2-8 2-12 0V7Z"/><path d="M-1 15c5-2 9-2 13 0 3 2 7 2 11 0 4-2 8-2 11 0v4c-5 2-9 2-13 0-3-2-7-2-11 0-4 2-8 2-12 0v-4Z"/><path d="M-1 23c5-2 9-2 13 0 3 2 7 2 11 0 4-2 8-2 11 0v4c-5 2-9 2-13 0-3-2-7-2-11 0-4 2-8 2-12 0v-4Z"/></g><circle cx="10" cy="11" r="1.25" fill="#ffd17a"/><circle cx="21" cy="21" r="1.6" fill="#ffd17a"/><circle cx="23" cy="11" r=".8" fill="#ffd17a"/></svg></span>
          <span><strong>Mars Route Planner</strong><small>Jezero crater · EVA planner</small></span>
        </a>
        <nav className="app-tabs" aria-label="Application views">
          <button className={`app-tab ${tab === 'planning' ? 'app-tab--active' : ''}`} type="button" aria-pressed={tab === 'planning'} onClick={() => setTab('planning')}><RouteIcon /><span>Planning</span></button>
          <button className={`app-tab ${tab === 'mars-data' ? 'app-tab--active' : ''}`} type="button" aria-pressed={tab === 'mars-data'} onClick={() => { setTab('mars-data'); setActiveTool(null) }}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 14.8V5a3 3 0 0 0-6 0v9.8a5 5 0 1 0 6 0Z"/><path d="M11 8v9"/><circle cx="11" cy="19" r="1.7"/></svg><span>Conditions</span></button>
        </nav>
        <div className="app-status"><span className="app-readout"><small>Latest MEDA sol</small><strong>{latestSol !== null ? `SOL ${latestSol}` : 'SOL —'}</strong></span><ViewToggle view={view} onChange={setView} /></div>
      </header>

      {tab === 'planning' && view === '2d' && <>
        <nav className="map-toolbar" aria-label="Map tools">
          <Button variant="ghost" size="icon" aria-label="Region information" title="Region information" aria-pressed={activeTool === 'info'} onClick={chooseTool}><InfoIcon /></Button>
          <div className="map-toolbar__sources" role="group" aria-label="Map data sources">{SOURCE_LAYERS.map((layer) => <Button key={layer.id} variant="ghost" size="icon" aria-label={`Toggle ${layer.label} layer`} title={layer.label} aria-pressed={activeLayers.includes(layer.id)} className={selectedSourceLayer === layer.id ? 'is-selected' : undefined} onClick={(event) => { const host = document.getElementById('map-area')?.getBoundingClientRect().top ?? 0; setSourcePanelTop(event.currentTarget.getBoundingClientRect().top - host); toggleLayer(layer.id); selectTarget(null); setSelectedSourceLayer((current) => current === layer.id ? null : layer.id); setActiveTool(null) }}>{layer.icon === 'temperature' ? <ThermometerIcon /> : layer.icon === 'slope' ? <SlopeIcon /> : <LayersIcon />}</Button>)}</div>
          <Button variant="ghost" size="icon" aria-label="Full screen" title="Full screen" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen().catch(() => undefined) }}><MaximizeIcon /></Button>
        </nav>
      </>}

      <main id="map-area" className="map-area" aria-label="Map area">
        {view === '3d' && tab === 'planning' ? (
          <Suspense fallback={<div className="three-d-loading">Loading 3D view…</div>}><ThreeDView targets={data?.targets ?? null} follow={follow3d} /><div className="dock-stack">
            {/* The 3D counterpart of the 2D "Recenter": the camera follows the astronaut during the EVA. */}
            {route && route.geometry.coordinates.length >= 2 && <Button variant="secondary" size="lg" className="map-recenter three-d__follow" aria-pressed={follow3d} title={follow3d ? 'The camera follows the astronaut during the EVA' : 'Free camera: press to follow the astronaut'} onClick={() => setFollow3d((value) => !value)}>
              <span className="map-recenter__icon"><LocateIcon /></span>
              <span className="map-recenter__label">Follow astronaut</span>
            </Button>}
            <div className="eva-dock eva-dock--idle eva-dock--3d"><SimulationControl /></div>
          </div></Suspense>
        ) : (
          <MapView onReady={setMapInstance}>
            <LayerManager />
            <SlopeLayer meta={data?.meta ?? null} />
            <RouteController />
            <RouteLayer />
            <RouteMarkers />
            <SimulationLayer />
            <RouteSummary />
            <TileHealth />
            <TileLoading />
            <DataStatus loading={!data && !error} error={error} />
            <FixedLayersBadge />
            {data && selectedSourceLayer && activeLayers.includes(selectedSourceLayer) && <div className="map-layer-legends ui-card" style={sourcePanelTop !== null ? { ['--source-top' as string]: `${sourcePanelTop}px` } : undefined}><div className="map-layer-legends__heading"><strong>{SOURCE_LAYERS.find((layer) => layer.id === selectedSourceLayer)?.label} source</strong><Button variant="ghost" size="icon" className="map-layer-legends__close" aria-label="Close source panel" onClick={() => setSelectedSourceLayer(null)}><CloseIcon /></Button></div><ProvenanceBadge activeLayers={[selectedSourceLayer]} missions={data.missions} /></div>}
            <ActiveLayerLegends activeLayers={activeLayers} recenterElevated={simulationStatus !== 'idle'} />
            <PlanningAreaFocus meta={data?.meta ?? null} />
            <WaypointsLayer meta={data?.meta ?? null} />
            {data && <TargetsLayer targets={data.targets} />}
            {data && activeTool !== 'info' && <TargetCard targets={data.targets} missions={data.missions} />}
          </MapView>
        )}
        {tab === 'planning' && view === '2d' && <>
          <button
            type="button"
            className={`ui-btn ui-btn--secondary ui-btn--lg map-recenter${recenterIndicator.centered ? ' map-recenter--centered' : ''}${simulationStatus !== 'idle' ? ' map-recenter--eva-active' : ''}`}
            title="Recenter on habitat"
            aria-label={recenterIndicator.centered ? 'Map centered on habitat' : 'Recenter on habitat'}
            data-centered={recenterIndicator.centered}
            onClick={recenterOnPlanningArea}
          ><span
            className="map-recenter__icon"
            style={{ transform: `rotate(${recenterIndicator.rotation}deg)` }}
            aria-hidden="true"
          ><NavigationIcon /></span>
            <span className="map-recenter__label">Recenter</span>
          </button>
        </>}
      </main>

      {tab === 'planning' && view === '2d' && panelTool && (
        <ToolPanel data={data} selectedTarget={selectedTarget ?? null} onSelectTarget={selectTarget} onClose={() => { setActiveTool(null); selectTarget(null) }} />
      )}

      {tab === 'mars-data' && <MarsDataScreen data={data} error={error} conditions={conditions} />}
      {tab === 'planning' && view === '2d' && <RouteMetricsBar values={routeValues} waypointCount={waypoints.length} />}
    </div>
  )
}

function ToolPanel({ data, selectedTarget, onSelectTarget, onClose }: {
  data: AppData | null
  selectedTarget: AppData['targets']['features'][number] | null
  onSelectTarget: (id: string | null) => void
  onClose: () => void
}) {
  return (
    <aside className="tool-panel ui-card" aria-label="Region information">
      <div className="tool-panel__heading"><div><span className="tool-panel__eyebrow">JEZERO CRATER</span><h2>Region information</h2></div><Button variant="ghost" size="icon" className="tool-panel__close" aria-label="Close panel" onClick={onClose}><CloseIcon /></Button></div>
      <p>Science targets and their source missions for the current map area.</p><div className="tool-target-list">{data?.targets.features.map((feature) => <button key={feature.properties.id} type="button" onClick={() => onSelectTarget(feature.properties.id)}><strong>{feature.properties.name}</strong><span>{feature.properties.why}</span></button>)}</div>{selectedTarget && <p className="tool-panel__selected">Selected: {selectedTarget.properties.name}</p>}
    </aside>
  )
}

function RouteMetricsBar({ values, waypointCount }: { values: { distance: string; time: number; oxygen: string; elevation: number } | null; waypointCount: number }) {
  const path = useSimulationPath()
  const snapshot = useSimulationSnapshot()
  const status = useSimulationStore((state) => state.status)
  const selectedPlan = useSimulationStore((state) => state.plan)
  const route = useAppStore((state) => state.route)
  const o2Budget = useAppStore((state) => state.evaParams.o2_available_kg)
  const live = status !== 'idle' && snapshot !== null
  const comparison = useMemo(() => route ? availablePlans(route).map((plan) => ({ plan, path: buildSimPath(route, plan) })) : [], [route])
  const selectedComparison = comparison.find((entry) => entry.plan === selectedPlan)?.path ?? path
  const bestFor = (field: 'oxygen' | 'time' | 'distance', lowerIsBetter = true) => {
    const selectedValue = field === 'oxygen' ? selectedComparison?.o2_kg.at(-1) : field === 'time' ? selectedComparison?.time_s.at(-1) : selectedComparison?.dist_m.at(-1)
    const candidates = comparison.map(({ path: candidate }) => field === 'oxygen' ? candidate.o2_kg.at(-1) : field === 'time' ? candidate.time_s.at(-1) : candidate.dist_m.at(-1)).filter((value): value is number => value !== undefined)
    if (selectedValue === undefined || candidates.length < 2) return false
    const best = lowerIsBetter ? Math.min(...candidates) : Math.max(...candidates)
    return Math.abs(selectedValue - best) < 0.001
  }
  const plannedO2 = path?.o2_kg.at(-1)
  const remainingO2 = plannedO2 === undefined ? null : Math.max(0, o2Budget - plannedO2)
  const metrics = [
    { icon: '◉', label: 'O₂ consumed', value: `${snapshot?.o2_used_kg.toFixed(2) ?? plannedO2?.toFixed(2) ?? '—'} kg`, best: bestFor('oxygen') },
    { icon: '▣', label: 'O₂ remaining', value: live ? `${snapshot.o2_left_kg.toFixed(2)} kg` : remainingO2 === null ? '—' : `${remainingO2.toFixed(2)} kg`, note: RESERVE_NOTE, best: bestFor('oxygen') },
    { icon: '◷', label: live ? 'Elapsed time' : 'Estimated time', value: live ? formatElapsed(snapshot.elapsed_s) : path ? `${Math.round((path.time_s.at(-1) ?? 0) / 60)} min` : '—', best: bestFor('time') },
    { icon: '⌁', label: 'Distance walked', value: live ? formatDistance(snapshot.dist_m) : path ? formatDistance(path.dist_m.at(-1) ?? 0) : `${waypointCount} points`, best: bestFor('distance') },
    { icon: '△', label: 'Elevation gain', value: values ? `+${Math.round(values.elevation)} m` : '—', best: false },
  ]
  if (!live) return <div className="eva-dock eva-dock--idle"><SimulationControl /></div>
  return <footer className="route-metrics route-metrics--live" aria-label="EVA simulation metrics">{metrics.map((metric) => <div className={`route-metric${metric.best ? ' route-metric--best' : ''}`} key={metric.label}><span className="route-metric__icon" aria-hidden="true">{metric.icon}</span><span><small>{metric.label}</small><strong>{metric.value}</strong>{'note' in metric && metric.note && <small className="route-metric__note">{metric.note}</small>}</span></div>)}<div className="route-metrics__eva"><SimulationControl /></div></footer>
}

function FixedLayersBadge() {
  return <div className="fixed-layers-badge" role="status" aria-label="Fixed map layers: CTX Jezero and HiRISE Jezero"><span className="fixed-layers-badge__label">BASE LAYERS</span><span><i aria-hidden="true" />CTX</span><span><i aria-hidden="true" />HiRISE</span></div>
}

function ActiveLayerLegends({ activeLayers, recenterElevated }: { activeLayers: LayerId[]; recenterElevated: boolean }) {
  const legends = activeLayers
    .filter((id) => SOURCE_LAYERS.some((source) => source.id === id))
    .map((id) => {
      const layer = LAYERS.find((item) => item.id === id)
      return layer?.legend
        ? <div className="map-active-legends__item" key={id}><Legend def={layer} /></div>
        : null
    })
    .filter((item) => item !== null)

  return <div className={`map-active-legends${legends.length ? ' is-open' : ''}${recenterElevated ? ' map-active-legends--eva' : ''}`} aria-label="Active layer legends" aria-hidden={!legends.length}><div className="map-active-legends__content">{legends}</div></div>
}
