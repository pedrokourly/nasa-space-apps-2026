import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from './MapContext';
import { useAppStore } from '../state/store';
import { toLatLng, type LonLat } from '../lib/mars-geo';

const ROUTE_PANE = 'routePane';
/** Amber, distinct from the cyan planned route; also used by the legend swatch in `RouteSummary.css`. */
const RETURN_COLOR = '#ffb300';
/** Violet for the way back to the route's start (`return_to_start`); also used by `RouteSummary.css`. */
const START_RETURN_COLOR = '#c084fc';
/** Grey for the part of a NO-GO route past the turn-back point; also used by `RouteSummary.css`. */
const MUTED_COLOR = '#8a94a3';

/**
 * Draws the store's `route` as a polyline (dark outline + cyan line), the estimated way home to the
 * habitat as a dashed amber line, the way back to the start (`return_to_start`) as a dotted violet
 * line and, on a NO-GO route, the part where no way back works in muted grey.
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
    const toTuples = (coords: [number, number][] | undefined): L.LatLngTuple[] =>
      (coords ?? []).map((c) => {
        const ll = toLatLng(c as LonLat);
        return [ll.lat, ll.lng] as L.LatLngTuple;
      });
    const p = route.properties;
    const toStart = p.return_to_start;
    // Estimated ways home: dashed lines under the planned route (added first, so they draw below).
    const homeLatLngs = toTuples(p.return_path?.coordinates);
    const startLatLngs = toTuples(toStart?.return_path?.coordinates);
    // NO-GO: the part after the last safe vertex (point of no return − 1) cannot be walked and still
    // get back, so it is drawn muted. With a start verdict too (route not starting at the habitat),
    // a vertex is only lost when NEITHER way back works, i.e. from the later of the two points of no
    // return; if only one verdict is NO-GO the other return still works everywhere, so nothing is
    // muted. With habitat point of no return 0 and no start verdict, the whole route is muted.
    const habitatPnr = p.verdict === 'NO-GO' ? p.point_of_no_return : undefined;
    const startPnr = toStart?.verdict === 'NO-GO' ? toStart.point_of_no_return : undefined;
    const pnr = !toStart
      ? habitatPnr
      : habitatPnr !== undefined && startPnr !== undefined
        ? Math.max(habitatPnr, startPnr)
        : undefined;
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
    // Start return: violet, a different dash rhythm than the habitat one so the two read apart even
    // where they overlap.
    if (startLatLngs.length >= 2) {
      layers.push(
        L.polyline(startLatLngs, { ...common, color: START_RETURN_COLOR, weight: 3, opacity: 0.95, dashArray: '3 7', lineCap: 'butt' }),
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
