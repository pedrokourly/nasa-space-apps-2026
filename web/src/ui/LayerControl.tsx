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

/** Compact layer picker beside its selected toolbar button. */
export default function LayerControl({ missions, terrainSource, visible = true }: Props) {
  const [open, setOpen] = useState(true)
  const activeLayers = useAppStore((state) => state.activeLayers)
  const toggleLayer = useAppStore((state) => state.toggleLayer)
  const permanentIds = ['ctx-jezero', 'hirise-jezero']
  const permanent = LAYERS.filter((layer) => permanentIds.includes(layer.id))
  const overlays = LAYERS.filter((layer) => layer.type === 'overlay')
  const base = LAYERS.find((layer) => layer.type === 'base' && activeLayers.includes(layer.id))
  const shown = base && !isGlobal(base) && !activeLayers.includes(BACKDROP_ID) ? [...activeLayers, BACKDROP_ID] : activeLayers

  if (!visible) return null
  return (
    <section className="layer-control" aria-label="Map layers">
      <button type="button" className="layer-control__toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span>Map layers</span><span aria-hidden="true">{open ? '⌄' : '›'}</span>
      </button>
      {open && <div className="layer-control__body">
        <fieldset className="layer-control__group">
          <legend>Permanent imagery</legend>
          {permanent.map((layer) => <div key={layer.id} className="layer-control__row layer-control__row--fixed"><span className="layer-control__lock" aria-hidden="true">●</span><span className="layer-control__name">{layer.id === 'ctx-jezero' ? 'CTX Jezero' : 'HiRISE Jezero'}</span><span className="layer-control__mission">{layer.shortLabel} · NASA</span></div>)}
        </fieldset>
        <fieldset className="layer-control__group layer-control__group--overlays">
          <legend>Terrain overlays</legend>
          {overlays.map((layer) => <label key={layer.id} className="layer-control__row layer-control__overlay-row"><input type="checkbox" checked={activeLayers.includes(layer.id)} onChange={() => toggleLayer(layer.id)} /><span className="layer-control__name">{layer.name}</span><span className="layer-control__mission">{layer.shortLabel}</span></label>)}
        </fieldset>
        <details className="layer-control__sources"><summary>Sources, instruments and dates</summary><ProvenanceBadge activeLayers={shown} missions={missions} terrainSource={terrainSource} /></details>
      </div>}
    </section>
  )
}
