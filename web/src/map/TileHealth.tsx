import { useEffect, useState } from 'react'
import L from 'leaflet'
import { useMap } from './MapContext'
import { isTileInBounds, isUnhealthy, recordError } from './tileErrors'
import './TileHealth.css'

/**
 * Non-blocking notice shown when tile layers keep failing to load. Attaches
 * generically to every `L.TileLayer` added to the map.
 */
export default function TileHealth() {
  const map = useMap()
  const [failing, setFailing] = useState<L.TileLayer[]>([])

  useEffect(() => {
    if (!map) return
    const errors = new Map<L.TileLayer, number[]>()
    const cleanups = new Map<L.TileLayer, () => void>()
    const sync = () => {
      const now = Date.now()
      const bad = [...errors.entries()].filter(([, t]) => isUnhealthy(t, now)).map(([l]) => l)
      setFailing((prev) => (prev.length === bad.length && prev.every((l, i) => l === bad[i]) ? prev : bad))
    }

    const attach = (layer: L.TileLayer) => {
      if (cleanups.has(layer)) return
      const onError = (e: L.TileErrorEvent) => {
        const bounds = layer.options.bounds
        if (bounds) {
          const size = layer.getTileSize()
          const { x, y, z } = e.coords
          const nw = map.unproject(L.point(x * size.x, y * size.y), z)
          const se = map.unproject(L.point((x + 1) * size.x, (y + 1) * size.y), z)
          const centre = { lat: (nw.lat + se.lat) / 2, lng: (nw.lng + se.lng) / 2 }
          const box = bounds instanceof L.LatLngBounds ? bounds : L.latLngBounds(bounds as L.LatLngBoundsLiteral)
          if (!isTileInBounds(box, centre)) return
        }
        errors.set(layer, recordError(errors.get(layer) ?? [], Date.now()))
        sync()
      }
      const onLoad = () => {
        if (errors.has(layer)) {
          errors.delete(layer)
          sync()
        }
      }
      layer.on('tileerror', onError)
      layer.on('tileload', onLoad)
      cleanups.set(layer, () => {
        layer.off('tileerror', onError)
        layer.off('tileload', onLoad)
        errors.delete(layer)
      })
    }

    const onAdd = (e: L.LayerEvent) => {
      if (e.layer instanceof L.TileLayer) attach(e.layer)
    }
    const onRemove = (e: L.LayerEvent) => {
      if (!(e.layer instanceof L.TileLayer)) return
      cleanups.get(e.layer)?.()
      cleanups.delete(e.layer)
      sync()
    }
    map.eachLayer((l) => {
      if (l instanceof L.TileLayer) attach(l)
    })
    map.on('layeradd', onAdd)
    map.on('layerremove', onRemove)
    // Errors age out of the window even if no new event arrives.
    const timer = window.setInterval(sync, 2000)
    return () => {
      window.clearInterval(timer)
      map.off('layeradd', onAdd)
      map.off('layerremove', onRemove)
      cleanups.forEach((c) => c())
      setFailing([])
    }
  }, [map])

  if (failing.length === 0) return null
  return (
    <div className="tile-health" role="status">
      <span>Some map tiles failed to load (NASA Mars Trek). Retrying may help.</span>
      <button
        type="button"
        onClick={() => {
          failing.forEach((l) => l.redraw())
        }}
      >
        Retry
      </button>
    </div>
  )
}
