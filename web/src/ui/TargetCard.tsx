import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppStore } from '../state/store';
import { findMission } from '../lib/missions';
import { useMap } from '../map/MapContext';
import { toLatLng } from '../lib/mars-geo';
import type { Mission, TargetsCollection } from '../types/contract';
import { Button } from './kit';
import { CloseIcon } from './icons';
import './TargetCard.css';

interface Props {
  targets: TargetsCollection;
  missions: readonly Mission[];
}

/** Gap kept between the card and the screen edges (px). */
const EDGE = 12;

/**
 * Card for the selected target, anchored to its marker on the map like a popover: why go, the
 * mission that revealed it (provenance) and the route action. It follows the marker when the map
 * moves or zooms, stays inside the screen, and opens below the marker when there is no room above.
 */
export default function TargetCard({ targets, missions }: Props) {
  const map = useMap();
  const selectedId = useAppStore((s) => s.selectedTargetId);
  const selectTarget = useAppStore((s) => s.selectTarget);
  const addWaypoint = useAppStore((s) => s.addWaypoint);
  const cardRef = useRef<HTMLElement>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [below, setBelow] = useState(false);

  const target = selectedId ? targets.features.find((f) => f.properties.id === selectedId) : undefined;
  const lon = target?.geometry.coordinates[0];
  const lat = target?.geometry.coordinates[1];

  // Screen point of the marker, updated while the map moves or zooms.
  useEffect(() => {
    if (!map || lon === undefined || lat === undefined) return;
    const update = () => {
      const p = map.latLngToContainerPoint(toLatLng([lon, lat]));
      setAnchor({ x: p.x, y: p.y });
    };
    update();
    map.on('move zoom resize', update);
    return () => {
      map.off('move zoom resize', update);
    };
  }, [map, lon, lat]);

  // Above the marker when it fits under the header, below it otherwise.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el || !anchor) return;
    const headerBottom = document.querySelector('.app-header')?.getBoundingClientRect().bottom ?? 80;
    setBelow(anchor.y - el.offsetHeight - 20 < headerBottom + EDGE);
  }, [anchor]);

  if (!target || lon === undefined || lat === undefined) return null;

  const { name, why, mission: missionId, mock } = target.properties;
  const mission = findMission(missions, missionId);
  const add = () => {
    const alreadyExists = useAppStore.getState().waypoints.some(([x, y]) => x === lon && y === lat);
    if (!alreadyExists) addWaypoint([lon, lat]);
  };

  // Keep the card inside the screen horizontally (it is centered on the marker).
  const half = Math.min(300, window.innerWidth - 2 * EDGE) / 2;
  const x = anchor ? Math.min(Math.max(anchor.x, half + EDGE), window.innerWidth - half - EDGE) : 0;
  const style = anchor ? ({ '--target-x': `${x}px`, '--target-y': `${anchor.y}px` } as React.CSSProperties) : { visibility: 'hidden' as const };

  return (
    <aside
      ref={cardRef}
      className={`target-card target-card--anchored${below ? ' target-card--below' : ''}`}
      style={style}
      aria-label={`Science target: ${name}`}
    >
      <Button variant="ghost" size="icon" className="target-card__close" aria-label="Close" onClick={() => selectTarget(null)}>
        <CloseIcon />
      </Button>
      <h2 className="target-card__title">{name}</h2>
      {mock && <p className="target-card__mock">Provisional text (mock)</p>}
      <p className="target-card__why">{why}</p>
      <div className="target-card__prov">
        <span className="target-card__prov-label">Revealed by</span>
        {mission ? (
          <>
            <strong>{mission.name}</strong>
            <span>
              {mission.instrument} · {mission.agency}
            </span>
            <a href={mission.link} target="_blank" rel="noopener noreferrer">
              Source
            </a>
          </>
        ) : (
          <strong>Mission not found</strong>
        )}
      </div>
      <Button size="sm" className="target-card__add" onClick={add}>
        Add to route
      </Button>
    </aside>
  );
}
