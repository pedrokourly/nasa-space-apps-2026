import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from './MapContext';
import { useSimulationStore } from '../state/simulationStore';
import { useSimulationPath, useSimulationSnapshot } from '../routing/useSimulation';
import { toLatLng, type LonLat } from '../lib/mars-geo';
import './SimulationLayer.css';

const SIM_PANE = 'simulationPane';

/**
 * EVA simulation on the map (issues #62 and #71), child of `<MapView>`: the walked part of the
 * selected plan's path, the astronaut marker, a flag when the point of no return has been passed
 * ('route' plan) and a flag where the astronaut turns back (return plans).
 */
export default function SimulationLayer() {
  const map = useMap();
  const path = useSimulationPath();
  const status = useSimulationStore((s) => s.status);
  const snap = useSimulationSnapshot();
  const walkedRef = useRef<L.Polyline | null>(null);
  const astronautRef = useRef<L.Marker | null>(null);
  const flagRef = useRef<L.Marker | null>(null);
  const returnFlagRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    // Above the route (450) and the route markers (650).
    const pane = map.getPane(SIM_PANE) ?? map.createPane(SIM_PANE);
    pane.style.zIndex = '700';
    pane.style.pointerEvents = 'none';
  }, [map]);

  const active = status !== 'idle' && snap !== null;
  const pastPnr = active && snap.pastPointOfNoReturn;
  const returning = active && snap.returning;
  const vertexIndex = snap?.vertexIndex ?? 0;
  const lon = snap?.lonlat[0];
  const lat = snap?.lonlat[1];

  // Walked part of the line and astronaut marker: created once per run, updated on each frame.
  useEffect(() => {
    if (!map) return;
    if (!active || !path || lon === undefined || lat === undefined) {
      walkedRef.current?.remove();
      walkedRef.current = null;
      astronautRef.current?.remove();
      astronautRef.current = null;
      return;
    }
    const pos = toLatLng([lon, lat]);
    const walked: L.LatLngTuple[] = path.coordinates.slice(0, vertexIndex + 1).map((c) => {
      const ll = toLatLng(c as LonLat);
      return [ll.lat, ll.lng];
    });
    walked.push([pos.lat, pos.lng]);
    if (!walkedRef.current) {
      walkedRef.current = L.polyline(walked, {
        pane: SIM_PANE,
        interactive: false,
        color: '#ffb300',
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
    } else {
      walkedRef.current.setLatLngs(walked);
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
  }, [map, path, active, vertexIndex, lon, lat]);

  // Flag at the point of no return, shown once the astronaut has passed it.
  useEffect(() => {
    if (!map || !path || !pastPnr) return;
    const idx = path.pnr_vertex;
    const c = idx === undefined ? undefined : path.coordinates[idx];
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
  }, [map, path, pastPnr]);

  // Flag where the astronaut turns back (return plans), shown once the way home has started.
  useEffect(() => {
    if (!map || !path || !returning) return;
    const idx = path.return_start_vertex;
    const c = idx === undefined ? undefined : path.coordinates[idx];
    if (!c) return;
    const label = path.plan === 'start' ? 'Returning to start' : 'Returning to habitat';
    const marker = L.marker(toLatLng([c[0], c[1]]), {
      pane: SIM_PANE,
      interactive: false,
      keyboard: false,
      icon: L.divIcon({ className: 'sim-return-flag', html: `<span>${label}</span>`, iconSize: [0, 0] }),
    }).addTo(map);
    returnFlagRef.current = marker;
    return () => {
      marker.remove();
      returnFlagRef.current = null;
    };
  }, [map, path, returning]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      walkedRef.current?.remove();
      walkedRef.current = null;
      astronautRef.current?.remove();
      astronautRef.current = null;
      flagRef.current?.remove();
      flagRef.current = null;
      returnFlagRef.current?.remove();
      returnFlagRef.current = null;
    };
  }, [map]);

  return null;
}
