import type { Mission } from '../types/contract';
import { LAYERS, isTileLayer, type LayerDef, type LegendDef } from '../map/layers';
import { crismProvenanceParts } from '../lib/crism';
import { useAppStore } from '../state/store';
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

/** Generic color legend (gradient bar or categorical swatches), used by any `LayerDef.legend`. */
export function Legend({ def, legend }: { def: LayerDef; legend?: LegendDef }) {
  const l = legend ?? def.legend;
  if (!l) return null;
  if ('entries' in l) {
    return (
      <div className="provenance__legend">
        <span className="provenance__legend-title">{l.title}</span>
        <ul className="provenance__legend-entries" aria-label={`${l.title}: color key`}>
          {l.entries.map((e) => (
            <li key={`${e.color}-${e.label}`}>
              <span className="provenance__legend-swatch" style={{ background: e.color }} aria-hidden="true" />
              {e.label}
            </li>
          ))}
        </ul>
        {l.note && <span className="provenance__legend-note">{l.note}</span>}
      </div>
    );
  }
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
  const crism = useAppStore((s) => s.crism);
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
              {(l.kind === 'crism' ? crismProvenanceParts(l.dataKind ?? 'Mineral map', crism) : provenanceParts(l, mission)).join(' · ')}{' '}
              <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer">
                Source
              </a>
            </p>
            {l.kind === 'crism' && crism?.source === 'mock' && (
              <p className="provenance__warn" role="status">
                Mock data: the real CRISM overlay has not been delivered yet; the colored blobs are made up.
              </p>
            )}
            {!mission && (
              <p className="provenance__warn" role="alert">
                Warning: mission “{l.missionId}” is not listed in missions.json.
              </p>
            )}
            <Legend def={l} legend={l.kind === 'crism' ? crism?.meta.legend : undefined} />
          </div>
        );
      })}
    </div>
  );
}
