import { useEffect, useState } from 'react'
import L from 'leaflet'
import { useMap } from './MapContext'
import { setLoading } from './loadingState'
import './TileLoading.css'

/**
 * Small non-blocking indicator shown while any tile layer is fetching tiles. Uses Leaflet's
 * `loading` / `load` events, which every `L.TileLayer` fires for its current view.
 */
export default function TileLoading() {
  const map = useMap()
  const [loading, setLoadingSet] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    if (!map) return
    const cleanups = new Map<L.TileLayer, () => void>()

    const attach = (layer: L.TileLayer) => {
      if (cleanups.has(layer)) return
      const id = String(L.Util.stamp(layer))
      const onStart = () => setLoadingSet((s) => setLoading(s, id, true))
      const onEnd = () => setLoadingSet((s) => setLoading(s, id, false))
      layer.on('loading', onStart)
      layer.on('load', onEnd)
      cleanups.set(layer, () => {
        layer.off('loading', onStart)
        layer.off('load', onEnd)
        onEnd()
      })
    }
    const onAdd = (e: L.LayerEvent) => {
      if (e.layer instanceof L.TileLayer) attach(e.layer)
    }
    const onRemove = (e: L.LayerEvent) => {
      if (!(e.layer instanceof L.TileLayer)) return
      cleanups.get(e.layer)?.()
      cleanups.delete(e.layer)
    }
    map.eachLayer((l) => {
      if (l instanceof L.TileLayer) attach(l)
    })
    map.on('layeradd', onAdd)
    map.on('layerremove', onRemove)
    return () => {
      map.off('layeradd', onAdd)
      map.off('layerremove', onRemove)
      cleanups.forEach((c) => c())
    }
  }, [map])

  return (
    <div className="tile-loading" role="status" aria-live="polite" hidden={loading.size === 0}>
      <span className="tile-loading__spinner" aria-hidden="true" />
      Loading map tiles…
    </div>
  )
}
