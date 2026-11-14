import { useState } from 'react'
import { useAppStore } from '../state/store'
import { BACKDROP_ID, LAYERS, isGlobal } from '../map/layers'
import type { Mission } from '../types/contract'
import ProvenanceBadge from './ProvenanceBadge'
import './LayerControl.css'

interface Props {
  missions: Mission[]
  terrainSource?: string
  visible?: boolean
}

/** Layer picker with terrain provenance and the active layer legend. */
export default function LayerControl({ missions, terrainSource, visible = true }: Props) {
  const [open, setOpen] = useState(true)
  const activeLayers = useAppStore((state) => state.activeLayers)
  const layerOpacity = useAppStore((state) => state.layerOpacity)
  const toggleLayer = useAppStore((state) => state.toggleLayer)
  const setLayerOpacity = useAppStore((state) => state.setLayerOpacity)
  const bases = LAYERS.filter((layer) => layer.type === 'base')
  const details = LAYERS.filter((layer) => layer.type === 'detail')
  const overlays = LAYERS.filter((layer) => layer.type === 'overlay')

  const toggleRow = (layer: (typeof LAYERS)[number]) => {
    const enabled = activeLayers.includes(layer.id)
    const opacity = layerOpacity[layer.id] ?? layer.defaultOpacity ?? 1
    return (
      <div key={layer.id} className="layer-control__overlay">
        <label className="layer-control__row">
          <input type="checkbox" checked={enabled} onChange={() => toggleLayer(layer.id)} />
          <span className="layer-control__name">{layer.name}</span>
          <span className="layer-control__mission">{layer.shortLabel}</span>
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          disabled={!enabled}
          aria-label={`Opacity: ${layer.name}`}
          onChange={(event) => setLayerOpacity(layer.id, Number(event.target.value))}
        />
      </div>
    )
  }

  const base = bases.find((layer) => activeLayers.includes(layer.id))
  const shown =
    base && !isGlobal(base) && !activeLayers.includes(BACKDROP_ID)
      ? [...activeLayers, BACKDROP_ID]
      : activeLayers
  if (!visible) return null

  return (
    <section className="layer-control" aria-label="Map layers">
      <button
        type="button"
        className="layer-control__toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>Map layers</span>
        <span aria-hidden="true">{open ? '⌄' : '›'}</span>
      </button>
      {open && (
        <div className="layer-control__body">
          <fieldset className="layer-control__group">
            <legend>Base map</legend>
            {bases.map((layer) => (
              <div key={layer.id} className="layer-control__row layer-control__row--fixed">
                <span className="layer-control__lock" aria-hidden="true">
                  ●
                </span>
                <span className="layer-control__name">{layer.name}</span>
                <span className="layer-control__mission">{layer.shortLabel}</span>
              </div>
            ))}
          </fieldset>
          <fieldset className="layer-control__group">
            <legend>Area of interest detail</legend>
            {details.map(toggleRow)}
          </fieldset>
          <fieldset className="layer-control__group">
            <legend>Overlays</legend>
            {overlays.map(toggleRow)}
          </fieldset>
        </div>
      )}
      <ProvenanceBadge activeLayers={shown} missions={missions} terrainSource={terrainSource} />
    </section>
  )
}
