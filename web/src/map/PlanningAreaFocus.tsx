import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from './MapContext';
import { useAppStore } from '../state/store';
import { bboxSizeM } from '../lib/bbox';
import type { Meta } from '../types/contract';
import './PlanningAreaFocus.css';

/** Above the tile (200) and overlay (400, slope) panes, below the route (450). */
const MASK_PANE = 'planningMaskPane';
const MASK_Z = 420;
/** Outline and label: just above the mask, still below the route. */
const OUTLINE_PANE = 'planningOutlinePane';
const OUTLINE_Z = 425;

const ACCENT = '#ffb454';
const MASK_FILL = 'rgba(5, 7, 12, 0.55)';
/** Margin (degrees) added around `maxBounds` so the mask always covers the view. */
const MARGIN_DEG = 2;

function getPane(map: L.Map, name: string, zIndex: number): HTMLElement {
  const pane = map.getPane(name) ?? map.createPane(name);
  pane.style.zIndex = String(zIndex);
  pane.style.pointerEvents = 'none';
  return pane;
}

/** Formats a length in meters as kilometers with one decimal (e.g. `7.9`). */
const km = (m: number) => (m / 1000).toFixed(1);

/**
 * Visual focus on the EVA planning area (the `meta.json` bbox): a dark mask over everything
 * outside it, a solid glowing outline and a size label. All layers are non-interactive, so map
 * clicks still reach WaypointsLayer. The mask is a polygon with the bbox as a hole, so the route,
 * markers, targets and the slope layer inside the area are never dimmed. Child of `<MapView>`.
 */
export default function PlanningAreaFocus({ meta }: { meta: Meta | null }) {
  const map = useMap();
  const focus = useAppStore((s) => s.focusPlanningArea);

  // Outline and size label (always on).
  useEffect(() => {
    if (!map || !meta) return;
    const [minLon, minLat, maxLon, maxLat] = meta.bbox;
    getPane(map, OUTLINE_PANE, OUTLINE_Z);
    const outline = L.rectangle(
      [
        [minLat, minLon],
        [maxLat, maxLon],
      ],
      {
        pane: OUTLINE_PANE,
        color: ACCENT,
        weight: 2,
        opacity: 1,
        fill: false,
        interactive: false,
        className: 'planning-area-outline',
      },
    ).addTo(map);

    const { widthM, heightM } = bboxSizeM(meta.bbox);
    const label = L.marker([maxLat, minLon], {
      pane: OUTLINE_PANE,
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: '',
        html: `<div class="planning-area-label">EVA planning area · ${km(widthM)} × ${km(heightM)} km</div>`,
        iconSize: [0, 0],
      }),
    }).addTo(map);

    return () => {
      outline.remove();
      label.remove();
    };
  }, [map, meta]);

  // Dark mask outside the bbox (toggle).
  useEffect(() => {
    if (!map || !meta || !focus) return;
    const [minLon, minLat, maxLon, maxLat] = meta.bbox;
    getPane(map, MASK_PANE, MASK_Z);
    const b = map.options.maxBounds ? L.latLngBounds(map.options.maxBounds as L.LatLngBoundsLiteral) : null;
    const south = b ? Math.max(-90, b.getSouth() - MARGIN_DEG) : -90;
    const north = b ? Math.min(90, b.getNorth() + MARGIN_DEG) : 90;
    const west = b ? Math.max(-180, b.getWest() - MARGIN_DEG) : -180;
    const east = b ? Math.min(180, b.getEast() + MARGIN_DEG) : 180;
    const mask = L.polygon(
      [
        [
          [south, west],
          [south, east],
          [north, east],
          [north, west],
        ],
        [
          [minLat, minLon],
          [minLat, maxLon],
          [maxLat, maxLon],
          [maxLat, minLon],
        ],
      ],
      { pane: MASK_PANE, stroke: false, fillColor: MASK_FILL, fillOpacity: 1, interactive: false },
    ).addTo(map);
    return () => {
      mask.remove();
    };
  }, [map, meta, focus]);

  return null;
}
