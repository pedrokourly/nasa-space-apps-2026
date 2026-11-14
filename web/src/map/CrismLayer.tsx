import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useMap } from './MapContext';
import { useAppStore } from '../state/store';
import { loadCrism } from '../lib/crism';

const LAYER_ID = 'crism';
/** Above the tile layers, below the slope hazard overlay (z 5). */
const Z_INDEX = 4;

/**
 * CRISM mineral overlay: the RGBA PNG from the pipeline (`crism.png`) placed on the `crism.json`
 * bbox with `L.imageOverlay`. Loaded the first time the layer is turned on; falls back to the mock
 * files when the real ones are missing (see `loadCrism`). Toggle and opacity come from the layer
 * control; the legend and provenance are shown there from the same JSON. Child of `<MapView>`.
 */
export default function CrismLayer() {
  const map = useMap();
  const on = useAppStore((s) => s.activeLayers.includes(LAYER_ID));
  const opacity = useAppStore((s) => s.layerOpacity[LAYER_ID] ?? 0.7);
  const crism = useAppStore((s) => s.crism);
  const setCrism = useAppStore((s) => s.setCrism);
  const [failed, setFailed] = useState(false);
  const overlay = useRef<L.ImageOverlay | null>(null);

  // Load once, the first time the layer is turned on.
  useEffect(() => {
    if (!on || crism || failed) return;
    const ctl = new AbortController();
    loadCrism({ signal: ctl.signal }).then(setCrism, (e: unknown) => {
      if (!ctl.signal.aborted) {
        console.error(e);
        setFailed(true);
      }
    });
    return () => ctl.abort();
  }, [on, crism, failed, setCrism]);

  useEffect(() => {
    if (!map || !crism || !on) return;
    const [minLon, minLat, maxLon, maxLat] = crism.meta.bbox;
    const layer = L.imageOverlay(
      crism.imageUrl,
      [
        [minLat, minLon],
        [maxLat, maxLon],
      ],
      {
        opacity,
        zIndex: Z_INDEX,
        alt: `CRISM mineral map (${crism.meta.mineral})${crism.source === 'mock' ? ', mock data' : ''}`,
        interactive: false,
      },
    );
    layer.addTo(map);
    overlay.current = layer;
    return () => {
      layer.remove();
      overlay.current = null;
    };
    // `opacity` is applied in the next effect without recreating the overlay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, crism, on]);

  useEffect(() => {
    overlay.current?.setOpacity(opacity);
  }, [opacity]);

  return failed && on ? (
    <div className="data-status" role="alert">
      Could not load the CRISM layer.
    </div>
  ) : null;
}
