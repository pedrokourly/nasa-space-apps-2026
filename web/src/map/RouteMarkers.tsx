import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from './MapContext';
import { useAppStore } from '../state/store';
import { toLatLng } from '../lib/mars-geo';
import { profilePointAt } from '../routing/profilePoint';
import './RouteMarkers.css';

/** Above the route (450) and the markers (600), without capturing the mouse. */
const HOVER_PANE = 'routeHoverPane';

const fmtKm = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtM = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/**
 * Markers tied to the route (issue #13), child of `<MapView>`:
 * - highlighted point of the elevation profile (`hoverProfileIndex`, written by the UI workstream's chart);
 * - points of no return: the habitat one (`route.properties.point_of_no_return`) and, when the route
 *   does not start at the habitat, the start one (`route.properties.return_to_start`), one per NO-GO.
 */
export default function RouteMarkers() {
  const map = useMap();
  const route = useAppStore((s) => s.route);
  const hoverIndex = useAppStore((s) => s.hoverProfileIndex);
  const hoverRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (!map) return;
    const pane = map.getPane(HOVER_PANE) ?? map.createPane(HOVER_PANE);
    pane.style.zIndex = '650';
    pane.style.pointerEvents = 'none';
  }, [map]);

  // Points of no return, one per NO-GO verdict: recreated only when the route changes.
  useEffect(() => {
    if (!map || !route) return;
    const props = route.properties;
    const toStart = props.return_to_start;
    const pnrs: { index: number; label: string; modifier: string }[] = [];
    // No habitat marker when even the start cannot reach the habitat: the route summary says so instead.
    if (props.verdict === 'NO-GO' && !props.start_unreachable && props.point_of_no_return !== undefined) {
      pnrs.push({ index: props.point_of_no_return, label: toStart ? 'Point of no return (habitat, estimate)' : 'Point of no return (estimate)', modifier: 'habitat' });
    }
    if (toStart?.verdict === 'NO-GO' && toStart.point_of_no_return !== undefined) {
      pnrs.push({ index: toStart.point_of_no_return, label: 'Point of no return (start, estimate)', modifier: 'start' });
    }
    const points = pnrs.map((m) => profilePointAt(route, m.index));
    // Two markers: the western one gets its label on the left, the eastern one on the right, so the
    // labels point away from each other (on the same vertex, the start label goes left).
    const westIdx =
      points.length === 2 && points[0] && points[1] ? (points[1].lonlat[0] <= points[0].lonlat[0] ? 1 : 0) : -1;
    const markers: L.Marker[] = [];
    for (const [k, { label, modifier }] of pnrs.entries()) {
      const p = points[k];
      if (!p) continue;
      const labelLeft = k === westIdx;
      markers.push(
        L.marker(toLatLng(p.lonlat), {
          pane: HOVER_PANE,
          interactive: false,
          keyboard: false,
          icon: L.divIcon({ className: `pnr-icon pnr-icon--${modifier}`, html: '<span>!</span>', iconSize: [22, 22], iconAnchor: [11, 11] }),
        })
          .bindTooltip(`${label} · ${fmtKm.format(p.dist_m / 1000)} km`, {
            permanent: true,
            direction: labelLeft ? 'left' : 'right',
            offset: [labelLeft ? -12 : 12, 0],
            className: `pnr-tooltip pnr-tooltip--${modifier}`,
          })
          .addTo(map),
      );
    }
    return () => {
      for (const m of markers) m.remove();
    };
  }, [map, route]);

  // Highlighted profile point: a single marker repositioned on each hover, never recreated.
  useEffect(() => {
    if (!map) return;
    const p = profilePointAt(route, hoverIndex);
    if (!p) {
      hoverRef.current?.remove();
      hoverRef.current = null;
      return;
    }
    const label = `${fmtKm.format(p.dist_m / 1000)} km · ${fmtM.format(p.elev_m)} m`;
    if (!hoverRef.current) {
      hoverRef.current = L.circleMarker(toLatLng(p.lonlat), {
        pane: HOVER_PANE,
        interactive: false,
        radius: 7,
        color: '#0b0d12',
        weight: 3,
        fillColor: '#ffffff',
        fillOpacity: 1,
      })
        .bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -8], className: 'profile-hover-tooltip' })
        .addTo(map);
    } else {
      hoverRef.current.setLatLng(toLatLng(p.lonlat));
      hoverRef.current.setTooltipContent(label);
    }
  }, [map, route, hoverIndex]);

  // Removes the hover marker on unmount or when the map changes.
  useEffect(() => {
    return () => {
      hoverRef.current?.remove();
      hoverRef.current = null;
    };
  }, [map]);

  return null;
}
