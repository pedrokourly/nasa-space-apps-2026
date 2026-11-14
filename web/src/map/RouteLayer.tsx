import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from './MapContext';
import { useAppStore } from '../state/store';
import { toLatLng, type LonLat } from '../lib/mars-geo';

const ROUTE_PANE = 'routePane';

/** Desenha `route` do store como polyline (contorno escuro + linha ciano). Filho de `<MapView>`. */
export default function RouteLayer() {
  const map = useMap();
  const route = useAppStore((s) => s.route);

  useEffect(() => {
    if (!map) return;
    // Acima das camadas de tiles/overlays (400) e abaixo dos marcadores (600).
    const pane = map.getPane(ROUTE_PANE) ?? map.createPane(ROUTE_PANE);
    pane.style.zIndex = '450';
    pane.style.pointerEvents = 'none';
  }, [map]);

  useEffect(() => {
    if (!map || !route || route.geometry.coordinates.length < 2) return;
    const latlngs = route.geometry.coordinates.map((c) => {
      const ll = toLatLng(c as LonLat);
      return [ll.lat, ll.lng] as L.LatLngTuple;
    });
    const common = { pane: ROUTE_PANE, interactive: false, lineCap: 'round', lineJoin: 'round' } as const;
    const group = L.layerGroup([
      L.polyline(latlngs, { ...common, color: '#0b0d12', weight: 7, opacity: 0.85 }),
      L.polyline(latlngs, { ...common, color: '#00e5ff', weight: 4, opacity: 1 }),
    ]).addTo(map);
    return () => {
      group.remove();
    };
  }, [map, route]);

  return null;
}
