import type L from 'leaflet';

/** Raiz dos tiles EPSG:4326 do NASA Mars Trek (ver docs/spike/mars-trek.md). */
const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ/';
const TILES = '/1.0.0/default/default028mm/{z}/{y}/{x}.';

export interface LayerDef {
  id: string;
  nome: string;
  /** Template `{z}/{y}/{x}` do tile. */
  url: string;
  /** `base`: uma por vez (rádio). `overlay`: liga/desliga com opacidade. */
  tipo: 'base' | 'overlay';
  /** Id da missão em `missions.json` (proveniência). */
  missionId: string;
  /** Sigla curta missão/instrumento para a interface. */
  sigla: string;
  formato: 'jpg' | 'png';
  minNativeZoom?: number;
  maxNativeZoom: number;
  /** Cobertura `[[sul, oeste], [norte, leste]]`, longitude −180..180. */
  bounds: L.LatLngBoundsLiteral;
  attribution: string;
  tileSize?: number;
  zoomOffset?: number;
  /** Opacidade inicial (padrão 1). */
  opacidadePadrao?: number;
}

export const LAYERS: LayerDef[] = [
  {
    id: 'ctx-jezero',
    nome: 'CTX Jezero (mosaico preliminar)',
    url: `${TREK}Jezero_CTX_BlockAdj_dd${TILES}png`,
    tipo: 'base',
    missionId: 'mro-ctx',
    sigla: 'MRO/CTX',
    formato: 'png',
    maxNativeZoom: 12,
    bounds: [
      [15.9058484, 75.1537692],
      [19.4453003, 78.8717121],
    ],
    attribution: 'NASA Mars Trek · MRO/CTX',
  },
  {
    id: 'hirise-jezero',
    nome: 'HiRISE Jezero (25 cm)',
    url: `${TREK}JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd${TILES}png`,
    tipo: 'base',
    missionId: 'mro-hirise',
    sigla: 'MRO/HiRISE',
    formato: 'png',
    maxNativeZoom: 17,
    bounds: [
      [18.3067994, 77.2229331],
      [18.669315, 77.583964],
    ],
    attribution: 'NASA Mars Trek · MRO/HiRISE',
  },
  {
    id: 'mola',
    nome: 'Relevo MOLA (cores e sombreamento)',
    url: `${TREK}Mars_MGS_MOLA_ClrShade_merge_global_463m${TILES}jpg`,
    tipo: 'base',
    missionId: 'mgs-mola',
    sigla: 'MGS/MOLA',
    formato: 'jpg',
    maxNativeZoom: 7,
    bounds: [
      [-89.9992, -180],
      [90, 179.9983],
    ],
    attribution: 'NASA Mars Trek · MGS/MOLA',
  },
  {
    id: 'viking-mdim',
    nome: 'Viking MDIM 2.1 (colorido)',
    url: `${TREK}Mars_Viking_MDIM21_ClrMosaic_global_232m${TILES}jpg`,
    tipo: 'base',
    missionId: 'viking-mdim',
    sigla: 'Viking/MDIM',
    formato: 'jpg',
    maxNativeZoom: 7,
    bounds: [
      [-90, -180],
      [90, 180],
    ],
    attribution: 'NASA Mars Trek · Viking/MDIM 2.1',
  },
  {
    id: 'themis-dia',
    nome: 'THEMIS infravermelho (dia)',
    url: `${TREK}THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018${TILES}png`,
    tipo: 'overlay',
    missionId: 'odyssey-themis',
    sigla: 'Odyssey/THEMIS',
    formato: 'png',
    maxNativeZoom: 9,
    bounds: [
      [-65.0006576, -179.9999997],
      [65.0007535, 179.9998849],
    ],
    attribution: 'NASA Mars Trek · Mars Odyssey/THEMIS',
    opacidadePadrao: 0.6,
  },
];

/** Base escolhida ao abrir o app. */
export const DEFAULT_BASE_ID = 'ctx-jezero';

/**
 * Base global usada como fundo quando a base escolhida é local (HiRISE, CTX
 * Jezero): esses PNGs são RGBA e transparentes fora da cobertura.
 */
export const BACKDROP_ID = 'mola';

export function getLayer(id: string): LayerDef | undefined {
  return LAYERS.find((l) => l.id === id);
}

/** True se a cobertura é o planeta inteiro (não precisa de fundo por baixo). */
export function isGlobal(def: LayerDef): boolean {
  const [[sul], [norte]] = def.bounds;
  return norte - sul >= 170;
}
