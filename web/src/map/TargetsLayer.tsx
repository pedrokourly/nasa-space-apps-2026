import { useEffect } from 'react';
import L from 'leaflet';
import { toLatLng } from '../lib/mars-geo';
import { useAppStore } from '../state/store';
import type { TargetsCollection } from '../types/contract';
import { useMap } from './MapContext';
import './TargetsLayer.css';

/** Raio (m) do círculo discreto que anota a região de interesse de cada alvo. */
const REGIAO_RAIO_M = 300;

function targetIcon(selecionado: boolean): L.DivIcon {
  return L.divIcon({
    className: `target-marker${selecionado ? ' target-marker--selected' : ''}`,
    html: '<span class="target-marker__diamond"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/**
 * Alvos científicos como marcadores em losango com rótulo sempre visível,
 * mais um círculo de ~300 m (não interativo) marcando a região de interesse.
 * Clicar seleciona o alvo e não propaga o clique ao mapa (sem criar waypoint).
 */
export default function TargetsLayer({ targets }: { targets: TargetsCollection }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    const markers = new Map<string, L.Marker>();

    for (const f of targets.features) {
      const { id, nome } = f.properties;
      const ll = toLatLng(f.geometry.coordinates);
      L.circle(ll, {
        radius: REGIAO_RAIO_M,
        interactive: false,
        color: '#ffb454',
        weight: 1,
        dashArray: '4 4',
        fillOpacity: 0.06,
      }).addTo(group);
      const marker = L.marker(ll, { icon: targetIcon(false), title: nome, keyboard: true, bubblingMouseEvents: false })
        .bindTooltip(nome, { permanent: true, direction: 'right', offset: [12, 0], className: 'target-label' })
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          useAppStore.getState().selectTarget(id);
        })
        .addTo(group);
      markers.set(id, marker);
    }

    let atual: string | null = null;
    const aplica = (sel: string | null) => {
      if (atual && atual !== sel) markers.get(atual)?.setIcon(targetIcon(false)).setZIndexOffset(0);
      if (sel) markers.get(sel)?.setIcon(targetIcon(true)).setZIndexOffset(1000);
      atual = sel;
    };
    aplica(useAppStore.getState().selectedTargetId);
    const unsub = useAppStore.subscribe((s, prev) => {
      if (s.selectedTargetId !== prev.selectedTargetId) aplica(s.selectedTargetId);
    });

    return () => {
      unsub();
      group.remove();
    };
  }, [map, targets]);

  return null;
}
