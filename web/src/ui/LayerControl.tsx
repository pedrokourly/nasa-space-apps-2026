import { useState } from 'react';
import { useAppStore } from '../state/store';
import { BACKDROP_ID, LAYERS, isGlobal } from '../map/layers';
import type { Mission } from '../types/contract';
import ProvenanceBadge from './ProvenanceBadge';
import './LayerControl.css';

/** Layer control: radio for the base, checkbox + opacity for overlays. */
export default function LayerControl({
  missions,
  terrainSource,
}: {
  missions: Mission[];
  /** `meta.json` `source`: provenance of the elevation grid used for routing. */
  terrainSource?: string;
}) {
  const [open, setOpen] = useState(true);
  const activeLayers = useAppStore((s) => s.activeLayers);
  const layerOpacity = useAppStore((s) => s.layerOpacity);
  const toggleLayer = useAppStore((s) => s.toggleLayer);
  const setBaseLayer = useAppStore((s) => s.setBaseLayer);
  const setLayerOpacity = useAppStore((s) => s.setLayerOpacity);

  const bases = LAYERS.filter((l) => l.type === 'base');
  const overlays = LAYERS.filter((l) => l.type === 'overlay');

  // Everything drawn on the map needs a provenance label, including the backdrop
  // that LayerManager puts under a local base.
  const base = bases.find((l) => activeLayers.includes(l.id));
  const shown =
    base && !isGlobal(base) && !activeLayers.includes(BACKDROP_ID) ? [...activeLayers, BACKDROP_ID] : activeLayers;

  return (
    <section className="layer-control" aria-label="Map layers">
      <button
        type="button"
        className="layer-control__toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Layers {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="layer-control__body">
          <fieldset className="layer-control__group">
            <legend>Base</legend>
            {bases.map((l) => (
              <label key={l.id} className="layer-control__row">
                <input
                  type="radio"
                  name="base-layer"
                  checked={activeLayers.includes(l.id)}
                  onChange={() => setBaseLayer(l.id)}
                />
                <span className="layer-control__name">{l.name}</span>
                <span className="layer-control__mission">{l.shortLabel}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="layer-control__group">
            <legend>Overlays</legend>
            {overlays.map((l) => {
              const on = activeLayers.includes(l.id);
              const opacity = layerOpacity[l.id] ?? l.defaultOpacity ?? 1;
              return (
                <div key={l.id} className="layer-control__overlay">
                  <label className="layer-control__row">
                    <input type="checkbox" checked={on} onChange={() => toggleLayer(l.id)} />
                    <span className="layer-control__name">{l.name}</span>
                    <span className="layer-control__mission">{l.shortLabel}</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={opacity}
                    disabled={!on}
                    aria-label={`Opacity: ${l.name}`}
                    onChange={(e) => setLayerOpacity(l.id, Number(e.target.value))}
                  />
                </div>
              );
            })}
          </fieldset>
        </div>
      )}
      <ProvenanceBadge activeLayers={shown} missions={missions} terrainSource={terrainSource} />
    </section>
  );
}
