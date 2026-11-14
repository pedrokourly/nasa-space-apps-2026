/**
 * Tipos do contrato de dados (AGENTS.md, seção 5). Fonte da verdade entre as frentes.
 *
 * Convenções:
 * - GeoJSON usa `[lon, lat]`; o Leaflet usa `[lat, lng]`. Converta só na borda do mapa.
 * - Longitude só em −180 a 180 (no contrato e no app). Converta 0–360 no pipeline.
 * - Distâncias só com `haversine` de `src/lib/mars-geo.ts` (R = 3389,5 km).
 */

// --- GeoJSON mínimo, escrito à mão (sem @types/geojson) ---

/** Posição GeoJSON: `[lon, lat]`. */
export type Position = [lon: number, lat: number];

export interface Point {
  type: 'Point';
  coordinates: Position;
}

export interface LineString {
  type: 'LineString';
  coordinates: Position[];
}

export interface Feature<G, P> {
  type: 'Feature';
  geometry: G;
  properties: P;
}

export interface FeatureCollection<G, P> {
  type: 'FeatureCollection';
  features: Feature<G, P>[];
}

// --- meta.json ---

export interface Meta {
  /** `[minLon, minLat, maxLon, maxLat]` em graus, longitude −180 a 180. */
  bbox: [minLon: number, minLat: number, maxLon: number, maxLat: number];
  /** Células por linha. */
  width: number;
  /** Número de linhas. */
  height: number;
  m_per_cell_x: number;
  m_per_cell_y: number;
  lon_convention: '-180..180';
  nodata: number;
  crs: 'EPSG:4326';
  /** Linha 0 é a borda norte. */
  row0: 'north';
  dtype: 'float32le';
  fonte?: string;
}

// --- missions.json ---

export interface Mission {
  /** Identificador estável, ex.: `"mro-hirise"`. */
  id: string;
  nome: string;
  instrumento: string;
  agencia: string;
  link: string;
  descricao?: string;
}

// --- targets.geojson ---

export interface TargetProps {
  id: string;
  nome: string;
  por_que: string;
  /** `Mission.id` da missão que revelou o alvo. */
  missao: string;
  mock?: boolean;
}

export type Target = Feature<Point, TargetProps>;
export type TargetsCollection = FeatureCollection<Point, TargetProps>;

// --- rota ---

export interface RouteProps {
  dist_m: number;
  tempo_s: number;
  o2_kg: number;
  /** Pares `[distância acumulada em m, elevação em m]`; o último tem `dist_m`. */
  perfil: [dist_m: number, elev_m: number][];
  veredito?: 'GO' | 'NO-GO';
  /** Índice do vértice no LineString. */
  ponto_nao_retorno?: number;
  mock?: boolean;
}

export type Route = Feature<LineString, RouteProps>;

// --- estado ---

export type RouteStatus = 'idle' | 'computing' | 'ready' | 'error';
export type LayerId = string;
