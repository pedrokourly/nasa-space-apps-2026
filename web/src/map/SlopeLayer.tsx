import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useMap } from './MapContext';
import { useAppStore } from '../state/store';
import { decodeFloat32LE } from '../routing/core/gridBinary';
import { slopeToRgba } from './slopeImage';
import type { Meta } from '../types/contract';

const LAYER_ID = 'slope';
const Z_INDEX = 5;

/** Draws the slope grid as a canvas image (PNG data URL) on the grid's exact bounds. */
async function renderSlopeUrl(meta: Meta, signal: AbortSignal): Promise<string> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/slope.bin`, { signal });
  if (!res.ok) throw new Error(`Failed to load slope.bin (HTTP ${res.status})`);
  const slope = decodeFloat32LE(await res.arrayBuffer(), meta.width * meta.height, 'slope.bin');
  const canvas = document.createElement('canvas');
  canvas.width = meta.width;
  canvas.height = meta.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  const pixels = slopeToRgba(meta, slope);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), meta.width, meta.height), 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Slope hazard overlay: steep terrain in red, built from the real `slope.bin` (degrees) and placed
 * with the `meta.json` bbox, so it lines up with the routing grid. Toggle and opacity come from
 * the layer control. Child of `<MapView>`.
 */
export default function SlopeLayer({ meta }: { meta: Meta | null }) {
  const map = useMap();
  const on = useAppStore((s) => s.activeLayers.includes(LAYER_ID));
  const opacity = useAppStore((s) => s.layerOpacity[LAYER_ID] ?? 0.6);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const overlay = useRef<L.ImageOverlay | null>(null);

  // Render once, the first time the layer is turned on.
  useEffect(() => {
    if (!on || !meta || url || failed) return;
    const ctl = new AbortController();
    renderSlopeUrl(meta, ctl.signal).then(setUrl, (e: unknown) => {
      if (!ctl.signal.aborted) {
        console.error(e);
        setFailed(true);
      }
    });
    return () => ctl.abort();
  }, [on, meta, url, failed]);

  useEffect(() => {
    if (!map || !meta || !url || !on) return;
    const [minLon, minLat, maxLon, maxLat] = meta.bbox;
    const layer = L.imageOverlay(
      url,
      [
        [minLat, minLon],
        [maxLat, maxLon],
      ],
      { opacity, zIndex: Z_INDEX, alt: 'Slope hazard map: steep terrain in red', interactive: false },
    );
    layer.addTo(map);
    overlay.current = layer;
    return () => {
      layer.remove();
      overlay.current = null;
    };
    // `opacity` is applied in the next effect without recreating the overlay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, meta, url, on]);

  useEffect(() => {
    overlay.current?.setOpacity(opacity);
  }, [opacity]);

  return failed && on ? (
    <div className="data-status" role="alert">
      Could not load the slope layer.
    </div>
  ) : null;
}
