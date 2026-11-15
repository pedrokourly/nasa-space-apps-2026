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
 * - point of no return (`route.properties.point_of_no_return`), once Routing delivers it.
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

  // Point of no return: recreated only when the route changes.
  useEffect(() => {
    // No marker when even the start cannot reach the habitat: the route summary says so instead.
    if (!map || route?.properties.start_unreachable) return;
    const p = profilePointAt(route, route?.properties.point_of_no_return);
    if (!p) return;
    const marker = L.marker(toLatLng(p.lonlat), {
      pane: HOVER_PANE,
      interactive: false,
      keyboard: false,
      icon: L.divIcon({ className: 'pnr-icon', html: '<span>!</span>', iconSize: [22, 22], iconAnchor: [11, 11] }),
    })
      .bindTooltip(`Point of no return · ${fmtKm.format(p.dist_m / 1000)} km`, {
        permanent: true,
        direction: 'right',
        offset: [12, 0],
        className: 'pnr-tooltip',
      })
      .addTo(map);
    return () => {
      marker.remove();
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
