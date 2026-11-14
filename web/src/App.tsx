import { useEffect, useState } from 'react'
import { loadData, type AppData } from './lib/loadData'
import MapView from './map/MapView'
import TargetsLayer from './map/TargetsLayer'
import TargetCard from './ui/TargetCard'
import WaypointsLayer from './map/WaypointsLayer'
import LayerManager from './map/LayerManager'
import LayerControl from './ui/LayerControl'
import RouteController from './routing/RouteController'
import RouteLayer from './map/RouteLayer'
import RouteMarkers from './map/RouteMarkers'
import RouteSummary from './ui/RouteSummary'
import TileHealth from './map/TileHealth'
import DataStatus from './ui/DataStatus'

export default function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData('mock').then(setData, (e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Martian Map · Jezero</h1>
      </header>
      <main id="map-area" className="map-area" aria-label="Map area">
        <MapView>
          <LayerManager />
          <LayerControl missions={data?.missions ?? []} />
          <RouteController />
          <RouteLayer />
          <RouteMarkers />
          <RouteSummary />
          <TileHealth />
          <DataStatus loading={!data && !error} error={error} />
          <WaypointsLayer meta={data?.meta ?? null} />
          {data && <TargetsLayer targets={data.targets} />}
          {data && <TargetCard targets={data.targets} missions={data.missions} />}
        </MapView>
      </main>
      <footer className="app-footer">
        {error
          ? `Error loading data: ${error}`
          : data
            ? `Data: MOCK · ${data.targets.features.length} targets · ${data.missions.length} missions`
            : 'Loading data…'}
      </footer>
    </div>
  )
}
