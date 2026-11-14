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
  const setLayerOpacity = useAppStore((s) => s.setLayerOpacity);
  const crism = useAppStore((s) => s.crism);
  const focusPlanningArea = useAppStore((s) => s.focusPlanningArea);
  const setFocusPlanningArea = useAppStore((s) => s.setFocusPlanningArea);

  const bases = LAYERS.filter((l) => l.type === 'base');
  const details = LAYERS.filter((l) => l.type === 'detail');
  const overlays = LAYERS.filter((l) => l.type === 'overlay');

  /** Checkbox + opacity slider, shared by the detail and overlay groups. */
  const toggleRow = (l: (typeof LAYERS)[number]) => {
    const on = activeLayers.includes(l.id);
    const opacity = layerOpacity[l.id] ?? l.defaultOpacity ?? 1;
    return (
      <div key={l.id} className="layer-control__overlay">
        <label className="layer-control__row">
          <input type="checkbox" checked={on} onChange={() => toggleLayer(l.id)} />
          <span className="layer-control__name">
            {l.name}
            {l.kind === 'crism' && crism?.source === 'mock' && <span className="layer-control__mock"> · MOCK</span>}
          </span>
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
  };

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
          <label className="layer-control__row layer-control__focus">
            <input
              type="checkbox"
              checked={focusPlanningArea}
              onChange={(e) => setFocusPlanningArea(e.target.checked)}
            />
            <span className="layer-control__name">Dim outside planning area</span>
          </label>
          <fieldset className="layer-control__group">
            <legend>Base map · always on</legend>
            {bases.map((l) => (
              <div key={l.id} className="layer-control__row layer-control__row--fixed">
                <span className="layer-control__lock" aria-hidden="true">●</span>
                <span className="layer-control__name">{l.name}</span>
                <span className="layer-control__mission">{l.shortLabel}</span>
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
  );
}
