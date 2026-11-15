import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from './MapContext';
import { useAppStore } from '../state/store';
import { toLatLng, type LonLat } from '../lib/mars-geo';

const ROUTE_PANE = 'routePane';
/** Amber, distinct from the cyan planned route; also used by the legend swatch in `RouteSummary.css`. */
const RETURN_COLOR = '#ffb300';
/** Grey for the part of a NO-GO route past the turn-back point; also used by `RouteSummary.css`. */
const MUTED_COLOR = '#8a94a3';

/**
 * Draws the store's `route` as a polyline (dark outline + cyan line), the estimated way home as a
 * dashed amber line and, on a NO-GO route, the part after the last safe vertex in muted grey.
 * Child of `<MapView>`.
 */
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
    // NO-GO: the part after the last safe vertex (point of no return − 1) cannot be walked and still
    // get home, so it is drawn muted. With point of no return 0, the whole route is muted.
    const p = route.properties;
    const pnr = p.verdict === 'NO-GO' ? p.point_of_no_return : undefined;
    const splitAt = pnr === undefined ? latlngs.length - 1 : Math.max(0, Math.min(pnr - 1, latlngs.length - 1));
    const walkable = latlngs.slice(0, splitAt + 1);
    const muted = latlngs.slice(splitAt);
    const layers: L.Layer[] = [];
    if (muted.length >= 2) {
      layers.push(
        L.polyline(muted, { ...common, color: '#0b0d12', weight: 6, opacity: 0.45 }),
        L.polyline(muted, { ...common, color: MUTED_COLOR, weight: 3, opacity: 0.75 }),
      );
    }
    if (homeLatLngs.length >= 2) {
      layers.push(
        L.polyline(homeLatLngs, { ...common, color: RETURN_COLOR, weight: 3, opacity: 0.95, dashArray: '8 8', lineCap: 'butt' }),
      );
    }
    if (walkable.length >= 2) {
      layers.push(
        L.polyline(walkable, { ...common, color: '#0b0d12', weight: 7, opacity: 0.85 }),
        L.polyline(walkable, { ...common, color: '#00e5ff', weight: 4, opacity: 1 }),
      );
    }
    const group = L.layerGroup(layers).addTo(map);
    return () => {
      group.remove();
    };
  }, [map, route]);

  return null;
}
