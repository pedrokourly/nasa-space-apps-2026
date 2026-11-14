import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from './MapContext';
import { useAppStore } from '../state/store';
import { BACKDROP_ID, LAYERS, getLayer, isGlobal, type LayerDef } from './layers';

/** HiRISE Jezero vai até o z17 nativo; acima disso o mapa não deixa dar zoom. */
const MAX_ZOOM = 17;

/** Ordem de empilhamento dentro do pane de tiles: fundo < base < overlays. */
const Z_BACKDROP = 1;
const Z_BASE = 2;
const Z_OVERLAY = 3;

function createTileLayer(def: LayerDef, zIndex: number, opacity: number): L.TileLayer {
  return L.tileLayer(def.url, {
    tileSize: def.tileSize ?? 256,
    zoomOffset: def.zoomOffset ?? 0,
    minNativeZoom: def.minNativeZoom,
    maxNativeZoom: def.maxNativeZoom,
    maxZoom: MAX_ZOOM,
    bounds: def.bounds,
    attribution: def.attribution,
    zIndex,
    opacity,
  });
}

/**
 * Sincroniza `activeLayers` e `layerOpacity` do store com as camadas de tiles do
 * mapa. Uma base por vez, mais os overlays ligados. Se a base escolhida é local
 * (PNG RGBA transparente fora da cobertura), a MOLA global fica por baixo.
 */
export default function LayerManager() {
  const map = useMap();
  const activeLayers = useAppStore((s) => s.activeLayers);
  const layerOpacity = useAppStore((s) => s.layerOpacity);
  const live = useRef(new Map<string, L.TileLayer>());

  useEffect(() => {
    if (!map) return;
    const current = live.current;

    const base = LAYERS.find((l) => l.tipo === 'base' && activeLayers.includes(l.id));
    const wanted = new Map<string, { def: LayerDef; z: number }>();
    if (base) {
      if (!isGlobal(base)) {
        const backdrop = getLayer(BACKDROP_ID);
        if (backdrop) wanted.set(backdrop.id, { def: backdrop, z: Z_BACKDROP });
      }
      wanted.set(base.id, { def: base, z: Z_BASE });
    }
    for (const l of LAYERS) {
      if (l.tipo === 'overlay' && activeLayers.includes(l.id)) wanted.set(l.id, { def: l, z: Z_OVERLAY });
    }

    for (const [id, layer] of current) {
      if (!wanted.has(id)) {
        layer.remove();
        current.delete(id);
      }
    }
    for (const [id, { def, z }] of wanted) {
      const opacity = layerOpacity[id] ?? def.opacidadePadrao ?? 1;
      const existing = current.get(id);
      if (existing) {
        existing.setOpacity(opacity);
        existing.setZIndex(z);
      } else {
        const layer = createTileLayer(def, z, opacity);
        layer.addTo(map);
        current.set(id, layer);
      }
    }
  }, [map, activeLayers, layerOpacity]);

  useEffect(() => {
    const current = live.current;
    return () => {
      for (const layer of current.values()) layer.remove();
      current.clear();
    };
  }, []);

  return null;
}
