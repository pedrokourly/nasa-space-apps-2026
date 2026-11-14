import { useAppStore } from '../state/store';
import { findMission } from '../lib/missions';
import type { Mission, TargetsCollection } from '../types/contract';
import './TargetCard.css';

interface Props {
  targets: TargetsCollection;
  missions: readonly Mission[];
}

/** Floating card for the selected target: why go, mission that revealed it (provenance) and route action. */
export default function TargetCard({ targets, missions }: Props) {
  const selectedId = useAppStore((s) => s.selectedTargetId);
  const selectTarget = useAppStore((s) => s.selectTarget);
  const addWaypoint = useAppStore((s) => s.addWaypoint);

  const target = selectedId ? targets.features.find((f) => f.properties.id === selectedId) : undefined;
  if (!target) return null;

  const { name, why, mission: missionId, mock } = target.properties;
  const mission = findMission(missions, missionId);
  const [lon, lat] = target.geometry.coordinates;

  const add = () => {
    const alreadyExists = useAppStore.getState().waypoints.some(([x, y]) => x === lon && y === lat);
    if (!alreadyExists) addWaypoint([lon, lat]);
  };

  return (
    <aside className="target-card" aria-label={`Science target: ${name}`}>
      <button type="button" className="target-card__close" aria-label="Close" onClick={() => selectTarget(null)}>
        ×
      </button>
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
      <button type="button" className="target-card__add" onClick={add}>
        Add to route
      </button>
    </aside>
  );
}
