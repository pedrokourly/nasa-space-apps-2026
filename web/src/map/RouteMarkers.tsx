import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from './MapContext';
import { useAppStore } from '../state/store';
import { toLatLng } from '../lib/mars-geo';
import { profilePointAt } from '../routing/profilePoint';
import './RouteMarkers.css';

/** Acima da rota (450) e dos marcadores (600), sem capturar o mouse. */
const HOVER_PANE = 'routeHoverPane';

const fmtKm = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/**
 * Marcadores ligados à rota (issue #13), filho de `<MapView>`:
 * - ponto em destaque do perfil de elevação (`hoverProfileIndex`, escrito pelo gráfico da frente UI);
 * - ponto de não retorno (`route.properties.ponto_nao_retorno`), quando o Roteamento entregar.
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

  // Ponto de não retorno: recriado só quando a rota muda.
  useEffect(() => {
    if (!map) return;
    const p = profilePointAt(route, route?.properties.ponto_nao_retorno);
    if (!p) return;
    const marker = L.marker(toLatLng(p.lonlat), {
      pane: HOVER_PANE,
      interactive: false,
      keyboard: false,
      icon: L.divIcon({ className: 'pnr-icon', html: '<span>!</span>', iconSize: [22, 22], iconAnchor: [11, 11] }),
    })
      .bindTooltip(`Ponto de não retorno · ${fmtKm.format(p.dist_m / 1000)} km`, {
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

  // Ponto em destaque do perfil: um único marcador reposicionado a cada hover, sem recriar.
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

  // Remove o marcador de hover ao desmontar ou trocar de mapa.
  useEffect(() => {
    return () => {
      hoverRef.current?.remove();
      hoverRef.current = null;
    };
  }, [map]);

  return null;
}
