import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from './MapContext';
import { useAppStore } from '../state/store';
import { useSimulationStore } from '../state/simulationStore';
import { useSimulationSnapshot } from '../routing/useSimulation';
import { toLatLng, type LonLat } from '../lib/mars-geo';
import './SimulationLayer.css';

const SIM_PANE = 'simulationPane';

/**
 * EVA simulation on the map (issue #62), child of `<MapView>`: the walked part of the route,
 * the astronaut marker and a flag when the point of no return has been passed.
 */
export default function SimulationLayer() {
  const map = useMap();
  const route = useAppStore((s) => s.route);
  const status = useSimulationStore((s) => s.status);
  const snap = useSimulationSnapshot();
  const walkedRef = useRef<L.Polyline | null>(null);
  const astronautRef = useRef<L.Marker | null>(null);
  const flagRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    // Above the route (450) and the route markers (650).
    const pane = map.getPane(SIM_PANE) ?? map.createPane(SIM_PANE);
    pane.style.zIndex = '700';
    pane.style.pointerEvents = 'none';
  }, [map]);

  const active = status !== 'idle' && snap !== null;
  const pastPnr = active && snap.pastPointOfNoReturn;
  const vertexIndex = snap?.vertexIndex ?? 0;
  const lon = snap?.lonlat[0];
  const lat = snap?.lonlat[1];

  // Walked part of the line and astronaut marker: created once per run, updated on each frame.
  useEffect(() => {
    if (!map) return;
    if (!active || !route || lon === undefined || lat === undefined) {
      walkedRef.current?.remove();
      walkedRef.current = null;
      astronautRef.current?.remove();
      astronautRef.current = null;
      return;
    }
    const pos = toLatLng([lon, lat]);
    const path: L.LatLngTuple[] = route.geometry.coordinates
      .slice(0, vertexIndex + 1)
      .map((c) => {
        const ll = toLatLng(c as LonLat);
        return [ll.lat, ll.lng];
      });
    path.push([pos.lat, pos.lng]);
    if (!walkedRef.current) {
      walkedRef.current = L.polyline(path, {
        pane: SIM_PANE,
        interactive: false,
        color: '#ffb300',
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
    } else {
      walkedRef.current.setLatLngs(path);
    }
    if (!astronautRef.current) {
      astronautRef.current = L.marker(pos, {
        pane: SIM_PANE,
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: 'sim-astronaut-icon',
          html: '<span aria-hidden="true"></span>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).addTo(map);
    } else {
      astronautRef.current.setLatLng(pos);
    }
  }, [map, route, active, vertexIndex, lon, lat]);

  // Flag at the point of no return, shown once the astronaut has passed it.
  useEffect(() => {
    if (!map || !route || !pastPnr) return;
    const idx = route.properties.point_of_no_return;
    const c = idx === undefined ? undefined : route.geometry.coordinates[idx];
    if (!c) return;
    const marker = L.marker(toLatLng([c[0], c[1]]), {
      pane: SIM_PANE,
      interactive: false,
      keyboard: false,
      icon: L.divIcon({ className: 'sim-pnr-flag', html: '<span>Passed point of no return</span>', iconSize: [0, 0] }),
    }).addTo(map);
    flagRef.current = marker;
    return () => {
      marker.remove();
      flagRef.current = null;
    };
  }, [map, route, pastPnr]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      walkedRef.current?.remove();
      walkedRef.current = null;
      astronautRef.current?.remove();
      astronautRef.current = null;
      flagRef.current?.remove();
      flagRef.current = null;
    };
  }, [map]);

  return null;
}
