import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from './MapContext';
import { useAppStore } from '../state/store';
import { toLatLng, type LonLat } from '../lib/mars-geo';

const ROUTE_PANE = 'routePane';
/** Amber, distinct from the cyan planned route; also used by the legend swatch in `RouteSummary.css`. */
const RETURN_COLOR = '#ffb300';

/** Draws the store's `route` as a polyline (dark outline + cyan line). Child of `<MapView>`. */
export default function RouteLayer() {
  const map = useMap();
  const route = useAppStore((s) => s.route);

  useEffect(() => {
    if (!map) return;
    // Above the tile/overlay layers (400) and below the markers (600).
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
    // Estimated way home: dashed amber line under the planned route (added first, so it draws below).
    const home = route.properties.return_path?.coordinates ?? [];
    const homeLatLngs = home.map((c) => {
      const ll = toLatLng(c as LonLat);
      return [ll.lat, ll.lng] as L.LatLngTuple;
    });
    const layers: L.Layer[] = [];
    if (homeLatLngs.length >= 2) {
      layers.push(
        L.polyline(homeLatLngs, { ...common, color: RETURN_COLOR, weight: 3, opacity: 0.95, dashArray: '8 8', lineCap: 'butt' }),
      );
    }
    layers.push(
      L.polyline(latlngs, { ...common, color: '#0b0d12', weight: 7, opacity: 0.85 }),
      L.polyline(latlngs, { ...common, color: '#00e5ff', weight: 4, opacity: 1 }),
    );
    const group = L.layerGroup(layers).addTo(map);
    return () => {
      group.remove();
    };
  }, [map, route]);

  return null;
}
