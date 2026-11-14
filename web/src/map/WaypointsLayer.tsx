import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useMap } from './MapContext';
import { useAppStore } from '../state/store';
import { toLatLng, toLonLat, type LonLat } from '../lib/mars-geo';
import { isInsideBbox } from '../lib/bbox';
import type { Meta } from '../types/contract';
import './WaypointsLayer.css';

const MSG_FORA =
  'Fora da área com relevo (bbox do grid). Escolha um ponto dentro do retângulo.';

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
 * Marcadores de partida (A) e paradas (1, 2, 3…) da rota. A fonte da verdade é
 * `waypoints` no store; os marcadores são sincronizados por diff a cada mudança.
 * Filho de `<MapView>`.
 */
export default function WaypointsLayer({ meta }: Props) {
  const map = useMap();
  const waypoints = useAppStore((s) => s.waypoints);
  const setWaypoints = useAppStore((s) => s.setWaypoints);
  const [aviso, setAviso] = useState<string | null>(null);

  const markersRef = useRef<L.Marker[]>([]);
  const bboxRef = useRef(meta?.bbox ?? null);
  const avisoTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    bboxRef.current = meta?.bbox ?? null;
  }, [meta]);

  const avisarRef = useRef((msg: string) => {
    setAviso(msg);
    window.clearTimeout(avisoTimer.current);
    avisoTimer.current = window.setTimeout(() => setAviso(null), 4000);
  });

  useEffect(() => () => window.clearTimeout(avisoTimer.current), []);

  // Clique no mapa adiciona ponto (se estiver dentro do bbox).
  useEffect(() => {
    if (!map) return;
    const onClick = (e: L.LeafletMouseEvent) => {
      const p = toLonLat(e.latlng);
      const bbox = bboxRef.current;
      if (bbox && !isInsideBbox(p, bbox)) {
        avisarRef.current(MSG_FORA);
        return;
      }
      useAppStore.getState().addWaypoint(p);
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map]);

  // Retângulo do bbox (área válida), não interativo.
  useEffect(() => {
    if (!map || !meta) return;
    const [minLon, minLat, maxLon, maxLat] = meta.bbox;
    const rect = L.rectangle(
      [
        [minLat, minLon],
        [maxLat, maxLon],
      ],
      { color: '#e8e6e3', weight: 1, opacity: 0.6, dashArray: '6 6', fill: false, interactive: false },
    ).addTo(map);
    return () => {
      rect.remove();
    };
  }, [map, meta]);

  // Sincroniza marcadores com o store (diff por índice).
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
      btn.textContent = 'Remover';
      btn.addEventListener('click', () => {
        const idx = indexOf(marker);
        if (idx >= 0) useAppStore.getState().removeWaypoint(idx);
      });
      popup.append(label, btn);
      marker.bindPopup(popup);
      marker.on('popupopen', () => {
        const idx = indexOf(marker);
        label.textContent = idx === 0 ? 'Partida (habitat)' : `Parada ${idx}`;
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
          avisarRef.current(MSG_FORA);
          return;
        }
        useAppStore.getState().moveWaypoint(idx, p);
      });

      markers.push(marker);
    });

    // Remove marcadores sobrando (ao final, já que o índice é a identidade).
    while (markers.length > waypoints.length) {
      const m = markers.pop();
      m?.off();
      m?.remove();
    }
  }, [map, waypoints]);

  // Limpeza ao desmontar ou trocar de mapa.
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
            ? 'Clique no mapa para definir a partida'
            : `${waypoints.length} ${waypoints.length === 1 ? 'ponto' : 'pontos'}`}
        </span>
        {waypoints.length > 0 && (
          <button type="button" onClick={() => setWaypoints([])}>
            Limpar rota
          </button>
        )}
      </div>
      {aviso && (
        <div className="waypoints-panel__warn" role="alert">
          {aviso}
        </div>
      )}
    </div>
  );
}
