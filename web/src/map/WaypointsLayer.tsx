import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useMap } from './MapContext';
import { useAppStore } from '../state/store';
import { toLatLng, toLonLat, type LonLat } from '../lib/mars-geo';
import { isInsideBbox } from '../lib/bbox';
import type { Meta } from '../types/contract';
import './WaypointsLayer.css';

const MSG_OUTSIDE =
  'Outside the EVA planning area (terrain data). Pick a point inside the highlighted area.';

function makeIcon(index: number): L.DivIcon {
  const start = index === 0;
  return L.divIcon({
    className: '',
    html: `<div class="wp-icon${start ? ' wp-icon--start' : ''}">${start ? 'A' : index}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

interface Props {
  meta: Meta | null;
}

/**
 * Start (A) and stop (1, 2, 3…) markers of the route. The source of truth is
 * `waypoints` in the store; markers are synced by diff on every change.
 * Child of `<MapView>`.
 */
export default function WaypointsLayer({ meta }: Props) {
  const map = useMap();
  const waypoints = useAppStore((s) => s.waypoints);
  const setWaypoints = useAppStore((s) => s.setWaypoints);
  const [warning, setWarning] = useState<string | null>(null);

  const markersRef = useRef<L.Marker[]>([]);
  const bboxRef = useRef(meta?.bbox ?? null);
  const warningTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    bboxRef.current = meta?.bbox ?? null;
  }, [meta]);

  const warnRef = useRef((msg: string) => {
    setWarning(msg);
    window.clearTimeout(warningTimer.current);
    warningTimer.current = window.setTimeout(() => setWarning(null), 4000);
  });

  useEffect(() => () => window.clearTimeout(warningTimer.current), []);

  // A map click adds a point (if it is inside the bbox).
  useEffect(() => {
    if (!map) return;
    const onClick = (e: L.LeafletMouseEvent) => {
      const p = toLonLat(e.latlng);
      const bbox = bboxRef.current;
      // Without meta.json loaded the point cannot be validated: ignore the click.
      if (!bbox) return;
      if (!isInsideBbox(p, bbox)) {
        warnRef.current(MSG_OUTSIDE);
        return;
      }
      useAppStore.getState().addWaypoint(p);
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map]);

  // Syncs markers with the store (diff by index).
  useEffect(() => {
    if (!map) return;
    const markers = markersRef.current;
    const indexOf = (m: L.Marker) => markers.indexOf(m);

    waypoints.forEach((wp, i) => {
      const ll = toLatLng(wp);
      const existing = markers[i];
      if (existing) {
        existing.setLatLng(ll);
        existing.setIcon(makeIcon(i));
        return;
      }
      const marker = L.marker(ll, { icon: makeIcon(i), draggable: true, keyboard: false }).addTo(map);

      const popup = document.createElement('div');
      popup.className = 'wp-popup';
      const label = document.createElement('div');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Remove';
      btn.addEventListener('click', () => {
        const idx = indexOf(marker);
        if (idx >= 0) useAppStore.getState().removeWaypoint(idx);
      });
      popup.append(label, btn);
      marker.bindPopup(popup);
      marker.on('popupopen', () => {
        const idx = indexOf(marker);
        // The start may be away from the habitat: the way home always leads to the habitat marker.
        label.textContent = idx === 0 ? 'Start' : `Stop ${idx}`;
      });

      marker.on('contextmenu', (e: L.LeafletMouseEvent) => {
        L.DomEvent.preventDefault(e.originalEvent);
        L.DomEvent.stopPropagation(e.originalEvent);
        const idx = indexOf(marker);
        if (idx >= 0) useAppStore.getState().removeWaypoint(idx);
      });

      marker.on('dragend', () => {
        const idx = indexOf(marker);
        if (idx < 0) return;
        const p: LonLat = toLonLat(marker.getLatLng());
        const bbox = bboxRef.current;
        if (bbox && !isInsideBbox(p, bbox)) {
          const prev = useAppStore.getState().waypoints[idx];
          if (prev) marker.setLatLng(toLatLng(prev));
          warnRef.current(MSG_OUTSIDE);
          return;
        }
        useAppStore.getState().moveWaypoint(idx, p);
      });

      markers.push(marker);
    });

    // Remove extra markers (from the end, since the index is the identity).
    while (markers.length > waypoints.length) {
      const m = markers.pop();
      m?.off();
      m?.remove();
    }
  }, [map, waypoints]);

  // Cleanup on unmount or when the map changes.
  useEffect(() => {
    const markers = markersRef.current;
    return () => {
      markers.forEach((m) => {
        m.off();
        m.remove();
      });
      markers.length = 0;
    };
  }, [map]);

  return (
    <div className="waypoints-panel">
      <div className="waypoints-panel__bar">
        <span>
          {waypoints.length === 0
            ? 'Click the map to set the start point'
            : `${waypoints.length} ${waypoints.length === 1 ? 'point' : 'points'}`}
        </span>
        {waypoints.length > 0 && (
          <button type="button" onClick={() => setWaypoints([])}>
            Clear route
          </button>
        )}
      </div>
      {warning && (
        <div className="waypoints-panel__warn" role="alert">
          {warning}
        </div>
      )}
    </div>
  );
}
