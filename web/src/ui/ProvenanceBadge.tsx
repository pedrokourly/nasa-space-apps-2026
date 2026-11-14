import type { Mission } from '../types/contract';
import { LAYERS, type LayerDef } from '../map/layers';
import './ProvenanceBadge.css';

/** Texto de proveniência de uma camada: imagem, missão, resolução e versão/data. */
function provenanceParts(def: LayerDef, mission: Mission | undefined): string[] {
  const quem = mission
    ? `${mission.instrumento} / ${mission.nome}, ${mission.agencia}`
    : def.sigla;
  return [
    `Imagem: ${quem}`,
    def.resolucao ?? 'resolução não informada',
    def.versaoOuData ?? 'data do mosaico não informada pelo Mars Trek',
  ];
}

/** Legenda genérica de cores (barra + rótulos), usada por qualquer `LayerDef.legenda`. */
export function Legend({ def }: { def: LayerDef }) {
  const l = def.legenda;
  if (!l) return null;
  return (
    <div className="provenance__legend">
      <span className="provenance__legend-title">{l.titulo}</span>
      <div
        className="provenance__legend-bar"
        role="img"
        aria-label={`${l.titulo}: de ${l.rotuloMin} a ${l.rotuloMax}`}
        style={{ background: `linear-gradient(to right, ${l.gradiente.join(', ')})` }}
      />
      <div className="provenance__legend-labels">
        <span>{l.rotuloMin}</span>
        <span>{l.rotuloMax}</span>
      </div>
      {l.nota && <span className="provenance__legend-note">{l.nota}</span>}
    </div>
  );
}

/** Proveniência das camadas ativas (sempre visível) + legenda de cores. */
export default function ProvenanceBadge({
  activeLayers,
  missions,
}: {
  activeLayers: string[];
  missions: Mission[];
}) {
  const ativas = LAYERS.filter((l) => activeLayers.includes(l.id));
  return (
    <div className="provenance" aria-label="Proveniência das camadas ativas">
      {ativas.map((l) => {
        const mission = missions.find((m) => m.id === l.missionId);
        return (
          <div key={l.id} className="provenance__item">
            <p className="provenance__line">
              {provenanceParts(l, mission).join(' · ')}{' '}
              <a href={l.fonteUrl} target="_blank" rel="noopener noreferrer">
                Fonte
              </a>
            </p>
            {!mission && (
              <p className="provenance__warn" role="alert">
                Aviso: missão “{l.missionId}” não consta em missions.json.
              </p>
            )}
            <Legend def={l} />
          </div>
        );
      })}
    </div>
  );
}
