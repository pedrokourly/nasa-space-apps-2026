import { useAppStore } from '../state/store';
import { findMission } from '../lib/missions';
import type { Mission, TargetsCollection } from '../types/contract';
import './TargetCard.css';

interface Props {
  targets: TargetsCollection;
  missions: readonly Mission[];
}

/** Card flutuante do alvo selecionado: por que ir, missão que o revelou (proveniência) e ação de rota. */
export default function TargetCard({ targets, missions }: Props) {
  const selectedId = useAppStore((s) => s.selectedTargetId);
  const selectTarget = useAppStore((s) => s.selectTarget);
  const addWaypoint = useAppStore((s) => s.addWaypoint);

  const target = selectedId ? targets.features.find((f) => f.properties.id === selectedId) : undefined;
  if (!target) return null;

  const { nome, por_que, missao, mock } = target.properties;
  const mission = findMission(missions, missao);
  const [lon, lat] = target.geometry.coordinates;

  const adicionar = () => {
    const jaExiste = useAppStore.getState().waypoints.some(([x, y]) => x === lon && y === lat);
    if (!jaExiste) addWaypoint([lon, lat]);
  };

  return (
    <aside className="target-card" aria-label={`Alvo científico: ${nome}`}>
      <button type="button" className="target-card__close" aria-label="Fechar" onClick={() => selectTarget(null)}>
        ×
      </button>
      <h2 className="target-card__title">{nome}</h2>
      {mock && <p className="target-card__mock">Texto provisório (mock)</p>}
      <p className="target-card__why">{por_que}</p>
      <div className="target-card__prov">
        <span className="target-card__prov-label">Revelado por</span>
        {mission ? (
          <>
            <strong>{mission.nome}</strong>
            <span>
              {mission.instrumento} · {mission.agencia}
            </span>
            <a href={mission.link} target="_blank" rel="noopener noreferrer">
              Fonte
            </a>
          </>
        ) : (
          <strong>Missão não encontrada</strong>
        )}
      </div>
      <button type="button" className="target-card__add" onClick={adicionar}>
        Adicionar à rota
      </button>
    </aside>
  );
}
