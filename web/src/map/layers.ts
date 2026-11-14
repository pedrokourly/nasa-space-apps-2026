import type L from 'leaflet';

/** Root of the NASA Mars Trek EPSG:4326 tiles (see docs/spike/mars-trek.md). */
const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ/';
const TILES = '/1.0.0/default/default028mm/{z}/{y}/{x}.';

/** Optional color legend (gradient bar with labels, without inventing values). */
export interface LegendDef {
  title: string;
  /** CSS gradient colors, from the minimum (left) to the maximum (right). */
  gradient: string[];
  minLabel: string;
  maxLabel: string;
  /** Note about the origin/accuracy of the colors. */
  note?: string;
}

export interface LayerDef {
  id: string;
  name: string;
  /** Tile `{z}/{y}/{x}` template. */
  url: string;
  /** `base`: one at a time (radio). `overlay`: toggled on/off with opacity. */
  type: 'base' | 'overlay';
  /** Mission id in `missions.json` (provenance). */
  missionId: string;
  /** Short mission/instrument label for the interface. */
  shortLabel: string;
  format: 'jpg' | 'png';
  minNativeZoom?: number;
  maxNativeZoom: number;
  /** Coverage `[[south, west], [north, east]]`, longitude −180..180. */
  bounds: L.LatLngBoundsLiteral;
  attribution: string;
  tileSize?: number;
  zoomOffset?: number;
  /** Initial opacity (default 1). */
  defaultOpacity?: number;
  /** Product ID on Mars Trek. */
  product: string;
  /** Version/date, only when it appears in the product ID itself. */
  versionOrDate?: string;
  /** Resolution, only when it appears in the product ID itself. */
  resolution?: string;
  /** Product WMTSCapabilities on Mars Trek (verifiable). */
  sourceUrl: string;
  legend?: LegendDef;
}

const wmts = (product: string) => `${TREK}${product}/1.0.0/WMTSCapabilities.xml`;

export const LAYERS: LayerDef[] = [
  {
    id: 'ctx-jezero',
    // Controlled 6 m mosaic: measured 0 px offset against HiRISE at z11. The wider
    // preliminary mosaic (Jezero_CTX_BlockAdj_dd) sits ~80 m south of both, so it was dropped.
    name: 'CTX Jezero (6 m, controlled)',
    url: `${TREK}JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0${TILES}png`,
    type: 'base',
    missionId: 'mro-ctx',
    shortLabel: 'MRO/CTX',
    format: 'png',
    maxNativeZoom: 13,
    bounds: [
      [18.2110274, 77.1604655],
      [18.7211945, 77.6991776],
    ],
    attribution: 'NASA Mars Trek · MRO/CTX',
    product: 'JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0',
    resolution: '6 m/px',
    sourceUrl: wmts('JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0'),
  },
  {
    // Whole planet at ~5 m/px, served by Esri (512 px tiles, one zoom level below Leaflet's).
    // Uncontrolled mosaic: measured ~80 m south of the controlled Jezero products at z11.
    id: 'ctx-global',
    name: 'CTX global mosaic (5 m, uncontrolled)',
    url: 'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/{z}/{y}/{x}',
    type: 'base',
    missionId: 'mro-ctx',
    shortLabel: 'MRO/CTX',
    format: 'png',
    tileSize: 512,
    zoomOffset: -1,
    minNativeZoom: 1,
    maxNativeZoom: 12,
    bounds: [
      [-90, -180],
      [90, 180],
    ],
    attribution: 'MRO/CTX: NASA/JPL/MSSS/Caltech Murray Lab/Esri',
    product: 'CTX_beta01_uncontrolled_5m_Caltech',
    versionOrDate: 'beta01',
    resolution: '5 m/px',
    sourceUrl: 'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer',
  },
  {
    id: 'hirise-jezero',
    name: 'HiRISE Jezero (25 cm)',
    url: `${TREK}JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd${TILES}png`,
    type: 'base',
    missionId: 'mro-hirise',
    shortLabel: 'MRO/HiRISE',
    format: 'png',
    maxNativeZoom: 17,
    bounds: [
      [18.3067994, 77.2229331],
      [18.669315, 77.583964],
    ],
    attribution: 'NASA Mars Trek · MRO/HiRISE',
    product: 'JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd',
    resolution: '25 cm/px',
    sourceUrl: wmts('JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd'),
  },
  {
    // Overlay, not a base: at 463 m/px it is a blur at walking scale (5–20 m/px), but a
    // translucent color tint over CTX/HiRISE still reads as "higher / lower" terrain.
    id: 'mola',
    name: 'MOLA elevation (color tint)',
    url: `${TREK}Mars_MGS_MOLA_ClrShade_merge_global_463m${TILES}jpg`,
    type: 'overlay',
    defaultOpacity: 0.4,
    missionId: 'mgs-mola',
    shortLabel: 'MGS/MOLA',
    format: 'jpg',
    maxNativeZoom: 7,
    bounds: [
      [-89.9992, -180],
      [90, 179.9983],
    ],
    attribution: 'NASA Mars Trek · MGS/MOLA',
    product: 'Mars_MGS_MOLA_ClrShade_merge_global_463m',
    resolution: '463 m/px',
    sourceUrl: wmts('Mars_MGS_MOLA_ClrShade_merge_global_463m'),
    // No numeric values: the product's official color ramp has not been verified.
    legend: {
      title: 'Elevation (MOLA)',
      gradient: ['#2b3a8f', '#3fa7c9', '#6dbb5a', '#e3d35a', '#c8742f', '#ffffff'],
      minLabel: 'lower',
      maxLabel: 'higher',
      note: 'Approximate colors; numeric scale not verified',
    },
  },
  {
    id: 'themis-dia',
    name: 'THEMIS daytime infrared',
    url: `${TREK}THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018${TILES}png`,
    type: 'overlay',
    missionId: 'odyssey-themis',
    shortLabel: 'Odyssey/THEMIS',
    format: 'png',
    maxNativeZoom: 9,
    bounds: [
      [-65.0006576, -179.9999997],
      [65.0007535, 179.9998849],
    ],
    attribution: 'NASA Mars Trek · Mars Odyssey/THEMIS',
    product: 'THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018',
    versionOrDate: 'v2, Oct 2018',
    resolution: '100 m/px',
    sourceUrl: wmts('THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018'),
    defaultOpacity: 0.6,
  },
];

/** Base chosen when the app opens. */
export const DEFAULT_BASE_ID = 'ctx-jezero';

/**
 * Global layers drawn underneath, fully opaque, when the chosen base is local (HiRISE,
 * CTX Jezero): those PNGs are transparent outside their coverage.
 * Far out, the color MOLA shows the planet; from z7 on (~325 m/px, below MOLA's 463 m)
 * the global CTX mosaic takes over so the terrain stays sharp around the local base.
 */
export const BACKDROPS: readonly { id: string; minZoom?: number; maxZoom?: number }[] = [
  { id: 'mola', maxZoom: 6 },
  { id: 'ctx-global', minZoom: 7 },
];

/** The backdrop layer drawn at a given map zoom. */
export function backdropAt(zoom: number): string | undefined {
  return BACKDROPS.find((b) => zoom >= (b.minZoom ?? 0) && zoom <= (b.maxZoom ?? Infinity))?.id;
}

export function getLayer(id: string): LayerDef | undefined {
  return LAYERS.find((l) => l.id === id);
}

/** True if the coverage is the whole planet (needs no backdrop beneath it). */
export function isGlobal(def: LayerDef): boolean {
  const [[south], [north]] = def.bounds;
  return north - south >= 170;
}
