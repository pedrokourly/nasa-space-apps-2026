import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { loadData, type AppData, type DataSource, type DataSources } from './lib/loadData'
import MapView from './map/MapView'
import TargetsLayer from './map/TargetsLayer'
import TargetCard from './ui/TargetCard'
import WaypointsLayer from './map/WaypointsLayer'
import PlanningAreaFocus from './map/PlanningAreaFocus'
import LayerManager from './map/LayerManager'
import SlopeLayer from './map/SlopeLayer'
import LayerControl from './ui/LayerControl'
import RouteController from './routing/RouteController'
import RouteLayer from './map/RouteLayer'
import RouteMarkers from './map/RouteMarkers'
import RouteSummary from './ui/RouteSummary'
import TileHealth from './map/TileHealth'
import DataStatus from './ui/DataStatus'
import ViewToggle, { type ViewMode } from './ui/ViewToggle'
import { useAppStore } from './state/store'
import { LAYERS } from './map/layers'
import type { LayerId } from './types/contract'
import './ui/PlannerShell.css'

const ThreeDView = lazy(() => import('./three-d/ThreeDView'))
const DATA_SOURCES: DataSources = { meta: 'real', targets: 'real', missions: 'real' }
const label = (source: DataSource) => (source === 'real' ? 'REAL DATA' : 'MOCK')
const JEZERO_OVERVIEW: L.LatLngTuple = [18.45, 77.43]

type AppTab = 'planning' | 'mars-data'
type ToolId = 'layers' | 'terrain' | 'info' | 'risks' | 'route'
type ToolButtonId = ToolId | 'home' | 'fullscreen'

const TOOLS: { id: ToolButtonId; icon: string; label: string }[] = [
  { id: 'home', icon: '⌂', label: 'Reset Jezero map view' },
  { id: 'layers', icon: '▱', label: 'Map layers' },
  { id: 'terrain', icon: '△', label: 'Terrain and relief' },
  { id: 'info', icon: 'ⓘ', label: 'Region information' },
  { id: 'fullscreen', icon: '⛶', label: 'Full screen' },
  { id: 'risks', icon: '⚠', label: 'Risk analysis' },
  { id: 'route', icon: '⌁', label: 'Route planning' },
]

export default function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('2d')
  const [tab, setTab] = useState<AppTab>('planning')
  const [activeTool, setActiveTool] = useState<ToolId | null>(null)
  const [hoveredTool, setHoveredTool] = useState<'terrain' | 'risks' | null>(null)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)
  const [recenterIndicator, setRecenterIndicator] = useState({ centered: false, rotation: 0 })
  const route = useAppStore((state) => state.route)
  const waypoints = useAppStore((state) => state.waypoints)
  const activeLayers = useAppStore((state) => state.activeLayers)
  const selectedTargetId = useAppStore((state) => state.selectedTargetId)
  const selectTarget = useAppStore((state) => state.selectTarget)
  const planningAreaCenter = useMemo(() => {
    const bbox = data?.meta.bbox
    return bbox
      ? [(bbox[1] + bbox[3]) / 2, (bbox[0] + bbox[2]) / 2] as L.LatLngTuple
      : JEZERO_OVERVIEW
  }, [data?.meta.bbox])

  useEffect(() => {
    loadData(DATA_SOURCES).then(setData, (e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

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

  const setLayersEnabled = (layerIds: LayerId[], enabled: boolean) => {
    const state = useAppStore.getState()
    for (const id of layerIds) {
      if (state.activeLayers.includes(id) !== enabled) state.toggleLayer(id)
    }
  }

  const chooseTool = (tool: ToolButtonId) => {
    if (tool === 'home') {
      mapInstance?.setView(JEZERO_OVERVIEW, 10)
      setActiveTool(null)
      return
    }
    if (tool === 'fullscreen') {
      if (document.fullscreenElement) void document.exitFullscreen()
      else void document.documentElement.requestFullscreen().catch(() => undefined)
      return
    }
    if (tool === 'terrain') {
      const enabled = activeLayers.includes('mola') || activeLayers.includes('slope')
      setLayersEnabled(['mola', 'slope'], !enabled)
      setActiveTool(null)
      return
    }
    if (tool === 'risks') {
      const enabled = activeLayers.includes('slope')
      setLayersEnabled(['slope'], !enabled)
      setActiveTool(null)
      return
    }
    setActiveTool((current) => (current === tool ? null : tool))
  }

  const fitRoute = () => {
    if (!mapInstance || !route) return
    const bounds = route.geometry.coordinates.map(([lon, lat]) => [lat, lon] as L.LatLngTuple)
    if (bounds.length) mapInstance.fitBounds(bounds, { padding: [100, 100], maxZoom: 14 })
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
  const panelTool = hoveredTool ?? (activeTool === 'terrain' || activeTool === 'risks' ? null : activeTool)

  return (
    <div className="app">
      <header className="app-header">
        <a className="app-brand" href="#map-area" aria-label="Martian Map home">
          <span className="app-brand__mark" aria-hidden="true">M</span>
          <span><strong>Martian Map</strong><small>Jezero crater · EVA planner</small></span>
        </a>
        <nav className="app-tabs" aria-label="Application views">
          <button className={`app-tab ${tab === 'planning' ? 'app-tab--active' : ''}`} type="button" aria-pressed={tab === 'planning'} onClick={() => setTab('planning')}>◎ <span>Planning</span></button>
          <button className={`app-tab ${tab === 'mars-data' ? 'app-tab--active' : ''}`} type="button" aria-pressed={tab === 'mars-data'} onClick={() => { setTab('mars-data'); setActiveTool(null) }}>▱ <span>Mars data</span></button>
        </nav>
        <div className="app-status"><span className="app-status__dot" /> STATIC DATA <span className="app-mock">MIXED SOURCES</span><ViewToggle view={view} onChange={setView} /></div>
      </header>

      {tab === 'planning' && view === '2d' && <>
        <nav className="map-toolbar" aria-label="Map tools">
          {TOOLS.map((tool) => {
            const terrainOn = tool.id === 'terrain' && (activeLayers.includes('mola') || activeLayers.includes('slope'))
            const risksOn = tool.id === 'risks' && activeLayers.includes('slope')
            const selected = tool.id === 'layers' ? activeTool === 'layers' : tool.id === 'terrain' ? terrainOn : tool.id === 'risks' ? risksOn : tool.id !== 'home' && tool.id !== 'fullscreen' && activeTool === tool.id
            return <button key={tool.id} type="button" title={tool.label} aria-label={tool.label} aria-pressed={tool.id !== 'home' && tool.id !== 'fullscreen' ? selected : undefined} className={selected ? 'is-active' : ''} onMouseEnter={() => { if (tool.id === 'terrain' || tool.id === 'risks') setHoveredTool(tool.id) }} onMouseLeave={() => { if (tool.id === 'terrain' || tool.id === 'risks') setHoveredTool(null) }} onClick={() => chooseTool(tool.id)}><span aria-hidden="true">{tool.icon}</span></button>
          })}
        </nav>
      </>}

      <main id="map-area" className="map-area" aria-label="Map area">
        {view === '3d' && tab === 'planning' ? (
          <Suspense fallback={<div className="three-d-loading">Loading 3D view…</div>}><ThreeDView targets={data?.targets ?? null} /></Suspense>
        ) : (
          <MapView onReady={setMapInstance}>
            <LayerManager />
            <SlopeLayer meta={data?.meta ?? null} />
            <LayerControl missions={data?.missions ?? []} terrainSource={data?.meta.source} visible={tab === 'planning' && activeTool === 'layers'} />
            <RouteController />
            <RouteLayer />
            <RouteMarkers />
            <RouteSummary />
            <TileHealth />
            <DataStatus loading={!data && !error} error={error} />
            <PlanningAreaFocus meta={data?.meta ?? null} />
            <WaypointsLayer meta={data?.meta ?? null} />
            {data && <TargetsLayer targets={data.targets} />}
            {data && <TargetCard targets={data.targets} missions={data.missions} />}
          </MapView>
        )}
        {tab === 'planning' && view === '2d' && <>
          <button
            type="button"
            className={`map-recenter${recenterIndicator.centered ? ' map-recenter--centered' : ''}`}
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

      {tab === 'planning' && view === '2d' && panelTool && panelTool !== 'layers' && (
        <ToolPanel tool={panelTool} hoverOnly={hoveredTool !== null} data={data} selectedTarget={selectedTarget ?? null} onSelectTarget={selectTarget} onClose={() => setActiveTool(null)} onFitRoute={fitRoute} routeSummary={routeValues ? `${routeValues.distance} km · ${routeValues.time} min · ${routeValues.oxygen} kg O₂` : 'Add route points on the map to calculate a plan.'} waypointCount={waypoints.length} terrainSource={data?.meta.source} />
      )}

      {tab === 'mars-data' && <MarsDataScreen data={data} error={error} />}
      {tab === 'planning' && view === '2d' && <RouteMetricsBar values={routeValues} mock={route?.properties.mock ?? false} waypointCount={waypoints.length} onFitRoute={fitRoute} />}
    </div>
  )
}

function ToolPanel({ tool, hoverOnly = false, data, selectedTarget, onSelectTarget, onClose, onFitRoute, routeSummary, waypointCount, terrainSource }: {
  tool: ToolId
  hoverOnly?: boolean
  data: AppData | null
  selectedTarget: AppData['targets']['features'][number] | null
  onSelectTarget: (id: string | null) => void
  onClose: () => void
  onFitRoute: () => void
  routeSummary: string
  waypointCount: number
  terrainSource?: string
}) {
  const title: Record<ToolId, string> = { layers: 'Map layers', terrain: 'Terrain and relief', info: 'Region information', risks: 'Risk analysis', route: 'Route planning' }
  const slope = LAYERS.find((layer) => layer.id === 'slope')
  return (
    <aside className={`tool-panel${hoverOnly ? ' tool-panel--hover' : ''}`} aria-label={title[tool]}>
      <div className="tool-panel__heading"><div><span className="tool-panel__eyebrow">JEZERO CRATER</span><h2>{title[tool]}</h2></div>{!hoverOnly && <button type="button" aria-label="Close panel" onClick={onClose}>×</button>}</div>
      {tool === 'terrain' && <><p>Real elevation grid and derived slope layer for the Jezero route area.</p><div className="tool-panel__source"><strong>Terrain source</strong><span>{terrainSource ?? 'Source information unavailable'}</span></div>{slope?.legend && <><strong>{slope.legend.title}</strong><div className="slope-legend" style={{ background: `linear-gradient(90deg, ${slope.legend.gradient.join(', ')})` }} /><div className="slope-legend__labels"><span>{slope.legend.minLabel}</span><span>{slope.legend.maxLabel}</span></div><p className="tool-panel__note">{slope.legend.note}</p></>}</>}
      {tool === 'risks' && <><p>Steep terrain is highlighted over the map from the real slope grid.</p><div className="tool-panel__source"><strong>Risk layer</strong><span>{slope?.shortLabel ?? 'Terrain slope'} · {slope?.versionOrDate ?? 'Source date listed in provenance'}</span></div><p className="tool-panel__note">{slope?.legend?.note ?? 'Routing assumptions are shown with the layer provenance.'}</p></>}
      {tool === 'info' && <><p>Science targets and their source missions for the current map area.</p><div className="tool-target-list">{data?.targets.features.map((feature) => <button key={feature.properties.id} type="button" onClick={() => onSelectTarget(feature.properties.id)}><strong>{feature.properties.name}</strong><span>{feature.properties.why}</span></button>)}</div>{selectedTarget && <p className="tool-panel__selected">Selected: {selectedTarget.properties.name}</p>}</>}
      {tool === 'route' && <><p>{waypointCount} route points</p><div className="tool-panel__route-summary">{routeSummary}</div><p className="tool-panel__note">O₂ remaining and vital signs appear when a verified mission budget and sensor readings are available.</p><button className="panel-action" type="button" onClick={onFitRoute}>Fit route to map</button></>}
    </aside>
  )
}

function RouteMetricsBar({ values, mock, waypointCount, onFitRoute }: { values: { distance: string; time: number; oxygen: string; elevation: number } | null; mock: boolean; waypointCount: number; onFitRoute: () => void }) {
  const metrics = [
    { icon: '◉', label: 'O₂ consumed', value: values ? `${values.oxygen} kg` : '—' },
    { icon: '▣', label: 'O₂ remaining', value: 'Not configured' },
    { icon: '◷', label: 'Estimated time', value: values ? `${values.time} min` : '—' },
    { icon: '⌁', label: 'Distance', value: values ? `${values.distance} km` : `${waypointCount} points` },
    { icon: '△', label: 'Elevation gain', value: values ? `+${Math.round(values.elevation)} m` : '—' },
    { icon: '♡', label: 'Vital signs', value: 'Not loaded' },
  ]
  return <footer className="route-metrics" aria-label="Route summary metrics">{metrics.map((metric) => <div className="route-metric" key={metric.label}><span className="route-metric__icon" aria-hidden="true">{metric.icon}</span><span><small>{metric.label}</small><strong>{metric.value}</strong></span></div>)}<div className="route-metrics__action">{mock && <span className="app-mock">MOCK</span>}<button className="route-fit-button" type="button" onClick={onFitRoute} disabled={!values}>Fit route</button></div></footer>
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
