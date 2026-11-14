import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from './MapContext';
import { useAppStore } from '../state/store';
import { BACKDROP_ID, LAYERS, getLayer, isGlobal, type LayerDef } from './layers';

/** HiRISE Jezero goes up to native z17; above that the map does not allow zooming. */
const MAX_ZOOM = 17;

/** Stacking order inside the tile pane: backdrop < base < overlays. */
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
 * Syncs `activeLayers` and `layerOpacity` from the store with the map's tile layers.
 * One base at a time, plus the enabled overlays. If the chosen base is local
 * (RGBA PNG, transparent outside its coverage), the global backdrop stays underneath.
 */
export default function LayerManager() {
  const map = useMap();
  const activeLayers = useAppStore((s) => s.activeLayers);
  const layerOpacity = useAppStore((s) => s.layerOpacity);
  const live = useRef(new Map<string, L.TileLayer>());

  useEffect(() => {
    if (!map) return;
    const current = live.current;

    const base = LAYERS.find((l) => l.type === 'base' && activeLayers.includes(l.id));
    // `opacity` set only for the backdrop, which is always drawn fully opaque.
    const wanted = new Map<string, { def: LayerDef; z: number; opacity?: number }>();
    if (base) {
      if (!isGlobal(base)) {
        const backdrop = getLayer(BACKDROP_ID);
        if (backdrop) wanted.set(backdrop.id, { def: backdrop, z: Z_BACKDROP, opacity: 1 });
      }
      wanted.set(base.id, { def: base, z: Z_BASE });
    }
    // An overlay that is also the backdrop takes over the same tile layer (overlay z and opacity).
    for (const l of LAYERS) {
      if (l.type === 'overlay' && activeLayers.includes(l.id)) wanted.set(l.id, { def: l, z: Z_OVERLAY });
    }

    for (const [id, layer] of current) {
      if (!wanted.has(id)) {
        layer.remove();
        current.delete(id);
      }
    }
    for (const [id, { def, z, opacity: forced }] of wanted) {
      const opacity = forced ?? layerOpacity[id] ?? def.defaultOpacity ?? 1;
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
