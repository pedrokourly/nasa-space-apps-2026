import { Suspense, lazy, useEffect, useState } from 'react'
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
import SimulationLayer from './map/SimulationLayer'
import SimulationControl from './ui/SimulationControl'
import TileHealth from './map/TileHealth'
import TileLoading from './map/TileLoading'
import DataStatus from './ui/DataStatus'
import ViewToggle, { type ViewMode } from './ui/ViewToggle'

// Cesium is heavy: the 3D view is its own chunk, fetched only when the user switches to it.
const ThreeDView = lazy(() => import('./three-d/ThreeDView'))

// Real data replaces mocks file by file. meta.json is the real Jezero grid and targets.geojson
// the real science targets (#28); missions.json lists the missions behind every layer and target.
const DATA_SOURCES: DataSources = { meta: 'real', targets: 'real', missions: 'real' }

const label = (s: DataSource) => (s === 'real' ? 'real' : 'MOCK')

export default function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('2d')

  useEffect(() => {
    loadData(DATA_SOURCES).then(setData, (e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Martian Map · Jezero</h1>
        <ViewToggle view={view} onChange={setView} />
      </header>
      <main id="map-area" className="map-area" aria-label="Map area">
        {view === '3d' ? (
          <Suspense fallback={<div className="three-d-loading">Loading 3D view…</div>}>
            <ThreeDView targets={data?.targets ?? null} />
          </Suspense>
        ) : (
          <MapView>
            <LayerManager />
            <SlopeLayer meta={data?.meta ?? null} />
            <LayerControl missions={data?.missions ?? []} terrainSource={data?.meta.source} />
            <RouteController />
            <RouteLayer />
            <RouteMarkers />
            <SimulationLayer />
            <RouteSummary />
            <SimulationControl />
            <TileHealth />
            <TileLoading />
            <DataStatus loading={!data && !error} error={error} />
            <PlanningAreaFocus meta={data?.meta ?? null} />
            <WaypointsLayer meta={data?.meta ?? null} />
            {data && <TargetsLayer targets={data.targets} />}
            {data && <TargetCard targets={data.targets} missions={data.missions} />}
          </MapView>
        )}
      </main>
      <footer className="app-footer">
        {error
          ? `Error loading data: ${error}`
          : data
            ? `Terrain: ${label(DATA_SOURCES.meta)} · ${data.targets.features.length} targets (${label(DATA_SOURCES.targets)}) · ${data.missions.length} missions (${label(DATA_SOURCES.missions)})`
            : 'Loading data…'}
      </footer>
    </div>
  )
}
