import { useState } from 'react';
import { useAppStore } from '../state/store';
import { LAYERS } from '../map/layers';
import type { Mission } from '../types/contract';
import ProvenanceBadge from './ProvenanceBadge';
import './LayerControl.css';

/** Controle de camadas: rádio para a base, checkbox + opacidade para overlays. */
export default function LayerControl({ missions }: { missions: Mission[] }) {
  const [open, setOpen] = useState(true);
  const activeLayers = useAppStore((s) => s.activeLayers);
  const layerOpacity = useAppStore((s) => s.layerOpacity);
  const toggleLayer = useAppStore((s) => s.toggleLayer);
  const setBaseLayer = useAppStore((s) => s.setBaseLayer);
  const setLayerOpacity = useAppStore((s) => s.setLayerOpacity);

  const bases = LAYERS.filter((l) => l.tipo === 'base');
  const overlays = LAYERS.filter((l) => l.tipo === 'overlay');

  return (
    <section className="layer-control" aria-label="Camadas do mapa">
      <button
        type="button"
        className="layer-control__toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Camadas {open ? '▾' : '▸'}
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
                <span className="layer-control__name">{l.nome}</span>
                <span className="layer-control__mission">{l.sigla}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="layer-control__group">
            <legend>Sobreposições</legend>
            {overlays.map((l) => {
              const on = activeLayers.includes(l.id);
              const opacity = layerOpacity[l.id] ?? l.opacidadePadrao ?? 1;
              return (
                <div key={l.id} className="layer-control__overlay">
                  <label className="layer-control__row">
                    <input type="checkbox" checked={on} onChange={() => toggleLayer(l.id)} />
                    <span className="layer-control__name">{l.nome}</span>
                    <span className="layer-control__mission">{l.sigla}</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={opacity}
                    disabled={!on}
                    aria-label={`Opacidade: ${l.nome}`}
                    onChange={(e) => setLayerOpacity(l.id, Number(e.target.value))}
                  />
                </div>
              );
            })}
          </fieldset>
        </div>
      )}
      <ProvenanceBadge activeLayers={activeLayers} missions={missions} />
    </section>
  );
}
