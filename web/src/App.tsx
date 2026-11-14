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
import RouteSummary from './ui/RouteSummary'

export default function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    loadData('mock').then(setData, (e: unknown) => setErro(e instanceof Error ? e.message : String(e)))
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Martian Map · Jezero</h1>
      </header>
      <main id="map-area" className="map-area" aria-label="Área do mapa">
        <MapView>
          <LayerManager />
          <LayerControl />
          <RouteController />
          <RouteLayer />
          <RouteSummary />
          <WaypointsLayer meta={data?.meta ?? null} />
          {data && <TargetsLayer targets={data.targets} />}
          {data && <TargetCard targets={data.targets} missions={data.missions} />}
        </MapView>
      </main>
      <footer className="app-footer">
        {erro
          ? `Erro ao carregar dados: ${erro}`
          : data
            ? `Dados: MOCK · ${data.targets.features.length} alvos · ${data.missions.length} missões`
            : 'Carregando dados…'}
      </footer>
    </div>
  )
}
