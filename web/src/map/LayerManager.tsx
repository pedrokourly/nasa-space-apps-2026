import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from './MapContext';
import { useAppStore } from '../state/store';
import { TRANSPARENT_TILE_URL } from './loadingState';
import { LAYERS, isTileLayer, type TileLayerDef } from './layers';

/** HiRISE Jezero goes up to native z17; above that the map does not allow zooming. */
const MAX_ZOOM = 17;

/** Stacking order inside the tile pane: backdrop < base < overlays. */
const Z_BASE = 2;
const Z_DETAIL = 3;
const Z_OVERLAY = 4;

function createTileLayer(def: TileLayerDef,zIndex: number, opacity: number): L.TileLayer {
  return L.tileLayer(def.url, {
    tileSize: def.tileSize ?? 256,
    zoomOffset: def.zoomOffset ?? 0,
    minNativeZoom: def.minNativeZoom,
    maxNativeZoom: def.maxNativeZoom,
    maxZoom: MAX_ZOOM,
    bounds: def.bounds,
    attribution: def.attribution,
    // Missing tiles show the dark map background instead of the browser's broken-image grey.
    errorTileUrl: TRANSPARENT_TILE_URL,
    zIndex,
    opacity,
  });
}

/**
 * Syncs `activeLayers` and `layerOpacity` from the store with the map's tile layers.
 * One base at a time, plus the enabled overlays.
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
    const wanted = new Map<string, { def: TileLayerDef; z: number; opacity?: number }>();
    if (base && isTileLayer(base)) {
      wanted.set(base.id, { def: base, z: Z_BASE });
    }
    // An overlay that is also the backdrop takes over the same tile layer (overlay z and opacity).
    for (const l of LAYERS) {
      // Data-driven overlays (slope, …) have their own component.
      if (l.type === 'base' || !isTileLayer(l) || !activeLayers.includes(l.id)) continue;
      wanted.set(l.id, { def: l, z: l.type === 'detail' ? Z_DETAIL : Z_OVERLAY });
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
