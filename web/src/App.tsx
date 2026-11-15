import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { findHabitat, loadData, type AppData, type DataSource, type DataSources } from './lib/loadData'
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
import './ui/PlannerShell.css'

const ThreeDView = lazy(() => import('./three-d/ThreeDView'))
const DATA_SOURCES: DataSources = { meta: 'real', targets: 'real', missions: 'real' }
const label = (source: DataSource) => (source === 'real' ? 'REAL DATA' : 'MOCK')
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
  const [view, setView] = useState<ViewMode>('2d')
  const [tab, setTab] = useState<AppTab>('planning')
  const [activeTool, setActiveTool] = useState<ToolId | null>(null)
  const [selectedSourceLayer, setSelectedSourceLayer] = useState<LayerId | null>(null)
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
    }).then((conditions) => setLatestSol(conditions.latest_sol)).catch(() => setLatestSol(null))
  }, [])

  useEffect(() => {
    if (selectedTargetId) setSelectedSourceLayer(null)
  }, [selectedTargetId])

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
        <a className="app-brand" href="#map-area" aria-label="Martian Map home">
          <span className="app-brand__mark" aria-hidden="true"><svg className="mars-icon" viewBox="0 0 32 32"><defs><linearGradient id="marsSurface" x1="3" y1="5" x2="29" y2="28" gradientUnits="userSpaceOnUse"><stop stopColor="#ffb13b"/><stop offset=".52" stopColor="#ff641d"/><stop offset="1" stopColor="#c92b25"/></linearGradient><clipPath id="marsSurfaceClip"><circle cx="16" cy="16" r="14"/></clipPath></defs><circle className="mars-icon__planet" cx="16" cy="16" r="14"/><g clipPath="url(#marsSurfaceClip)" fill="#9f2028" opacity=".86"><path d="M-2 7c5-2 9-2 13 0 3 2 7 2 11 0 4-2 8-2 12 0v4c-5 2-9 2-13 0-3-2-7-2-11 0-4 2-8 2-12 0V7Z"/><path d="M-1 15c5-2 9-2 13 0 3 2 7 2 11 0 4-2 8-2 11 0v4c-5 2-9 2-13 0-3-2-7-2-11 0-4 2-8 2-12 0v-4Z"/><path d="M-1 23c5-2 9-2 13 0 3 2 7 2 11 0 4-2 8-2 11 0v4c-5 2-9 2-13 0-3-2-7-2-11 0-4 2-8 2-12 0v-4Z"/></g><circle cx="10" cy="11" r="1.25" fill="#ffd17a"/><circle cx="21" cy="21" r="1.6" fill="#ffd17a"/><circle cx="23" cy="11" r=".8" fill="#ffd17a"/></svg></span>
          <span><strong>Martian Map</strong><small>Jezero crater · EVA planner</small></span>
        </a>
        <nav className="app-tabs" aria-label="Application views">
          <button className={`app-tab ${tab === 'planning' ? 'app-tab--active' : ''}`} type="button" aria-pressed={tab === 'planning'} onClick={() => setTab('planning')}>◎ <span>Planning</span></button>
          <button className={`app-tab ${tab === 'mars-data' ? 'app-tab--active' : ''}`} type="button" aria-pressed={tab === 'mars-data'} onClick={() => { setTab('mars-data'); setActiveTool(null) }}>▱ <span>Mars data</span></button>
        </nav>
        <div className="app-status"><span className="app-readout"><small>Latest MEDA sol</small><strong>{latestSol !== null ? `SOL ${latestSol}` : 'SOL —'}</strong></span><ViewToggle view={view} onChange={setView} /></div>
      </header>

      {tab === 'planning' && view === '2d' && <>
        <nav className="map-toolbar" aria-label="Map tools">
          <button type="button" aria-label="Region information" aria-pressed={activeTool === 'info'} className={activeTool === 'info' ? 'is-active' : ''} onClick={chooseTool}><span aria-hidden="true">ⓘ</span></button>
          <div className="map-toolbar__sources" role="group" aria-label="Map data sources">{SOURCE_LAYERS.map((layer) => <button key={layer.id} type="button" aria-label={`Toggle ${layer.label} layer`} aria-pressed={activeLayers.includes(layer.id)} className={`${activeLayers.includes(layer.id) ? 'is-active' : ''}${selectedSourceLayer === layer.id ? ' is-selected' : ''}`} onClick={() => { toggleLayer(layer.id); selectTarget(null); setSelectedSourceLayer((current) => current === layer.id ? null : layer.id); setActiveTool(null) }}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{layer.icon === 'temperature' ? <><path d="M14 14.8V5a3 3 0 0 0-6 0v9.8a5 5 0 1 0 6 0Z"/><path d="M11 8v9"/><circle cx="11" cy="19" r="1.7"/></> : layer.icon === 'slope' ? <><path d="M3 20 10 7l4 7 3-5 4 11H3Z"/><path d="m7 17 4-3 3 2 4-5"/></> : <><path d="M3 19c3-1 4-6 8-6s5 4 10 2"/><path d="M4 14c3-1 4-5 8-5 3 0 4 2 7 1"/><path d="M6 8c2-.7 3-3 6-3 2 0 3 1 5 1"/></>}</svg></button>)}</div>
          <button type="button" aria-label="Full screen" title="Full screen" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen().catch(() => undefined) }}><span aria-hidden="true">⛶</span></button>
        </nav>
      </>}

      <main id="map-area" className="map-area" aria-label="Map area">
        {view === '3d' && tab === 'planning' ? (
          <Suspense fallback={<div className="three-d-loading">Loading 3D view…</div>}><ThreeDView targets={data?.targets ?? null} /><SimulationControl /></Suspense>
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
            {data && selectedSourceLayer && activeLayers.includes(selectedSourceLayer) && <div className="map-layer-legends"><div className="map-layer-legends__heading"><strong>{SOURCE_LAYERS.find((layer) => layer.id === selectedSourceLayer)?.label} source</strong><button type="button" aria-label="Close source panel" onClick={() => setSelectedSourceLayer(null)}>×</button></div><ProvenanceBadge activeLayers={[selectedSourceLayer]} missions={data.missions} /></div>}
            <ActiveLayerLegends activeLayers={activeLayers} />
            <PlanningAreaFocus meta={data?.meta ?? null} />
            <WaypointsLayer meta={data?.meta ?? null} />
            {data && <TargetsLayer targets={data.targets} />}
            {data && activeTool !== 'info' && <TargetCard targets={data.targets} missions={data.missions} />}
          </MapView>
        )}
        {tab === 'planning' && view === '2d' && <>
          <button
            type="button"
            className={`map-recenter${recenterIndicator.centered ? ' map-recenter--centered' : ''}${simulationStatus !== 'idle' ? ' map-recenter--eva-active' : ''}`}
            title="Recenter on habitat"
            aria-label={recenterIndicator.centered ? 'Map centered on habitat' : 'Recenter on habitat'}
            data-centered={recenterIndicator.centered}
            onClick={recenterOnPlanningArea}
          ><span
            className="map-recenter__icon"
            style={{ transform: `rotate(${recenterIndicator.rotation}deg)` }}
            aria-hidden="true"
          ><svg viewBox="0 0 24 24" focusable="false"><path d="M12 2 4 21l8-4 8 4L12 2Z" /><path d="M12 17V8" /></svg></span>
            <span className="map-recenter__label">Recenter</span>
          </button>
        </>}
      </main>

      {tab === 'planning' && view === '2d' && panelTool && (
        <ToolPanel data={data} selectedTarget={selectedTarget ?? null} onSelectTarget={selectTarget} onClose={() => { setActiveTool(null); selectTarget(null) }} />
      )}

      {tab === 'mars-data' && <MarsDataScreen data={data} error={error} />}
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
    <aside className="tool-panel" aria-label="Region information">
      <div className="tool-panel__heading"><div><span className="tool-panel__eyebrow">JEZERO CRATER</span><h2>Region information</h2></div><button type="button" aria-label="Close panel" onClick={onClose}>×</button></div>
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
    { icon: '▣', label: 'O₂ remaining', value: live ? `${snapshot.o2_left_kg.toFixed(2)} kg` : remainingO2 === null ? '—' : `${remainingO2.toFixed(2)} kg`, best: bestFor('oxygen') },
    { icon: '◷', label: live ? 'Elapsed time' : 'Estimated time', value: live ? formatElapsed(snapshot.elapsed_s) : path ? `${Math.round((path.time_s.at(-1) ?? 0) / 60)} min` : '—', best: bestFor('time') },
    { icon: '⌁', label: 'Distance walked', value: live ? formatDistance(snapshot.dist_m) : path ? formatDistance(path.dist_m.at(-1) ?? 0) : `${waypointCount} points`, best: bestFor('distance') },
    { icon: '△', label: 'Elevation gain', value: values ? `+${Math.round(values.elevation)} m` : '—', best: false },
  ]
  if (!live) return <div className="eva-dock eva-dock--idle"><SimulationControl /></div>
  return <footer className="route-metrics route-metrics--live" aria-label="Live EVA metrics">{metrics.map((metric) => <div className={`route-metric${metric.best ? ' route-metric--best' : ''}`} key={metric.label}><span className="route-metric__icon" aria-hidden="true">{metric.icon}</span><span><small>{metric.label}</small><strong>{metric.value}</strong></span></div>)}<div className="route-metrics__eva"><SimulationControl /></div></footer>
}

function FixedLayersBadge() {
  return <div className="fixed-layers-badge" role="status" aria-label="Fixed map layers: CTX Jezero and HiRISE Jezero"><span className="fixed-layers-badge__label">BASE LAYERS</span><span><i aria-hidden="true" />CTX</span><span><i aria-hidden="true" />HiRISE</span></div>
}

function ActiveLayerLegends({ activeLayers }: { activeLayers: LayerId[] }) {
  const legends = activeLayers
    .filter((id) => SOURCE_LAYERS.some((source) => source.id === id))
    .map((id, index) => {
      const layer = LAYERS.find((item) => item.id === id)
      return layer?.legend
        ? <div className="map-active-legends__item" style={{ gridColumn: index + 1, justifySelf: index === 0 ? 'start' : index === 1 ? 'center' : 'end' }} key={id}><Legend def={layer} /></div>
        : null
    })
    .filter((item) => item !== null)

  if (legends.length === 0) return null
  return <div className="map-active-legends" aria-label="Active layer legends">{legends}</div>
}

function MarsDataScreen({ data, error }: { data: AppData | null; error: string | null }) {
  const meda = data?.missions.find((mission) => mission.instrument.includes('MEDA'))
  const dataCards = [
    { icon: '♨', title: 'Current climate', fields: [['Temperature', '—'], ['Wind', '—'], ['Dust', '—']], source: meda ? `${meda.instrument} · ${meda.name}` : 'MEDA · Perseverance' },
    { icon: '◉', title: 'Atmosphere', fields: [['Pressure', '—'], ['Composition', 'Not loaded'], ['Last available sol', 'Not provided']], source: meda ? `${meda.instrument} · ${meda.agency}` : 'MEDA · NASA' },
    { icon: '▱', title: 'Soil and composition', fields: [['Mineral products', 'Select a layer to inspect'], ['Science targets', String(data?.targets.features.length ?? '—')]], source: 'CRISM · MRO' },
    { icon: '⌖', title: 'Local geology', fields: [['Mapped science targets', String(data?.targets.features.length ?? '—')], ['Selected region', 'Jezero crater']], source: 'Target catalog · provenance on each target' },
    { icon: '◎', title: 'Radiation', fields: [['Radiation reading', '—'], ['Latest available sol', 'Not provided']], source: 'RAD / Curiosity · data not loaded' },
    { icon: '♧', title: 'Mission data status', fields: [['Terrain grid', 'REAL DATA'], ['Science targets', 'REAL DATA'], ['Mission catalog', label(DATA_SOURCES.missions)]], source: 'Each layer lists its source and available date' },
  ]
  return <section className="mars-data-screen" aria-label="Mars data dashboard"><div className="mars-data-screen__title"><div><span className="tool-panel__eyebrow">LATEST AVAILABLE · NOT LIVE</span><h1>Mars data for Jezero</h1><p>Mission products and verified regional information. Missing readings are left blank rather than estimated.</p></div><span className="data-status-pill">{error ? 'DATA ERROR' : data ? 'STATIC DATA' : 'LOADING'}</span></div><div className="mars-data-grid">{dataCards.map((card) => <article className="mars-data-card" key={card.title}><div className="mars-data-card__header"><span aria-hidden="true">{card.icon}</span><h2>{card.title}</h2></div><div className="mars-data-card__fields">{card.fields.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><footer>{card.source}</footer></article>)}</div><div className="mars-data-provenance"><span>DATA PROVENANCE</span><p>Terrain: {data?.meta.source ?? 'Loading source…'}</p><p>Targets: {label(DATA_SOURCES.targets)} · Mission catalog: {label(DATA_SOURCES.missions)} · {data?.missions.length ?? 0} missions</p><p>Weather, atmosphere and radiation readings are not included in the current static data.</p></div></section>
}
