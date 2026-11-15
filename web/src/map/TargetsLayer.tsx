import { useEffect } from 'react';
import L from 'leaflet';
import { toLatLng } from '../lib/mars-geo';
import { useAppStore } from '../state/store';
import type { TargetsCollection } from '../types/contract';
import { useMap } from './MapContext';
import './TargetsLayer.css';

function targetIcon(selected: boolean): L.DivIcon {
  return L.divIcon({
    className: `target-marker${selected ? ' target-marker--selected' : ''}`,
    html: '<span class="target-marker__diamond"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/**
 * Science targets as diamond markers without map labels or region circles.
 * Clicking selects the target and does not propagate the click to the map (no waypoint is created).
 */
export default function TargetsLayer({ targets }: { targets: TargetsCollection }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    const markers = new Map<string, L.Marker>();

    for (const f of targets.features) {
      const { id, name } = f.properties;
      const ll = toLatLng(f.geometry.coordinates);
      const marker = L.marker(ll, { icon: targetIcon(false), alt: name, keyboard: true, bubblingMouseEvents: false })
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          useAppStore.getState().selectTarget(id);
        })
        .addTo(group);
      markers.set(id, marker);
    }

    let current: string | null = null;
    const apply = (sel: string | null) => {
      if (current && current !== sel) markers.get(current)?.setIcon(targetIcon(false)).setZIndexOffset(0);
      if (sel) markers.get(sel)?.setIcon(targetIcon(true)).setZIndexOffset(1000);
      current = sel;
    };
    apply(useAppStore.getState().selectedTargetId);
    const unsub = useAppStore.subscribe((s, prev) => {
      if (s.selectedTargetId !== prev.selectedTargetId) apply(s.selectedTargetId);
    });

    return () => {
      unsub();
      group.remove();
    };
  }, [map, targets]);

  return null;
}
