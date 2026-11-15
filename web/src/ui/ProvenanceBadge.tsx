import type { Mission } from '../types/contract';
import { LAYERS, isTileLayer, type LayerDef } from '../map/layers';
import './ProvenanceBadge.css';

/** Provenance text of a layer: imagery, mission, resolution and version/date. */
function provenanceParts(def: LayerDef, mission: Mission | undefined): string[] {
  const who = mission
    ? `${mission.instrument} / ${mission.name}, ${mission.agency}`
    : def.shortLabel;
  const tiles = isTileLayer(def);
  return [
    `${def.dataKind ?? 'Imagery'}: ${who}`,
    ...(def.resolution ?? (tiles ? 'resolution not provided' : null) ? [def.resolution ?? 'resolution not provided'] : []),
    ...(def.versionOrDate ?? (tiles ? 'mosaic date not provided by Mars Trek' : null)
      ? [def.versionOrDate ?? 'mosaic date not provided by Mars Trek']
      : []),
  ];
}

/** Generic color legend (bar + labels), used by any `LayerDef.legend`. */
export function Legend({ def }: { def: LayerDef }) {
  const l = def.legend;
  if (!l) return null;
  return (
    <div className="provenance__legend">
      <span className="provenance__legend-title">{l.title}</span>
      <div
        className="provenance__legend-bar"
        role="img"
        aria-label={`${l.title}: from ${l.minLabel} to ${l.maxLabel}`}
        style={{ background: `linear-gradient(to right, ${l.gradient.join(', ')})` }}
      />
      <div className="provenance__legend-labels">
        <span>{l.minLabel}</span>
        <span>{l.maxLabel}</span>
      </div>
      {l.note && <span className="provenance__legend-note">{l.note}</span>}
    </div>
  );
}

/** Provenance of the active layers (always visible) + color legend. */
export default function ProvenanceBadge({
  activeLayers,
  missions,
  terrainSource,
}: {
  activeLayers: string[];
  missions: Mission[];
  /** Provenance of the elevation grid the routes are computed on (`meta.json` `source`). */
  terrainSource?: string;
}) {
  const active = LAYERS.filter((l) => activeLayers.includes(l.id));
  const doi = terrainSource?.match(/DOI\s+(10\.\S+?)[),\s]/)?.[1];
  return (
    <div className="provenance" aria-label="Provenance of the active layers">
      {terrainSource && (
        <div className="provenance__item">
          <p className="provenance__line">
            Terrain (routes, slope, O₂): {terrainSource}
            {doi && (
              <>
                {' '}
                <a href={`https://doi.org/${doi}`} target="_blank" rel="noopener noreferrer">
                  Source
                </a>
              </>
            )}
          </p>
        </div>
      )}
      {active.map((l) => {
        const mission = missions.find((m) => m.id === l.missionId);
        return (
          <div key={l.id} className="provenance__item">
            <p className="provenance__line">
              {provenanceParts(l, mission).join(' · ')}{' '}
              <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer">
                Source
              </a>
            </p>
            {!mission && (
              <p className="provenance__warn" role="alert">
                Warning: mission “{l.missionId}” is not listed in missions.json.
              </p>
            )}
            <Legend def={l} />
          </div>
        );
      })}
    </div>
  );
}
