/**
 * Data contract types (AGENTS.md, section 5). Source of truth between the workstreams.
 *
 * Conventions:
 * - GeoJSON uses `[lon, lat]`; Leaflet uses `[lat, lng]`. Convert only at the map boundary.
 * - Longitude only in −180 to 180 (in the contract and in the app). Convert 0–360 in the pipeline.
 * - Distances only with `haversine` from `src/lib/mars-geo.ts` (R = 3389.5 km).
 */

// --- Minimal GeoJSON, hand-written (no @types/geojson) ---

/** GeoJSON position: `[lon, lat]`. */
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
  /** `[minLon, minLat, maxLon, maxLat]` in degrees, longitude −180 to 180. */
  bbox: [minLon: number, minLat: number, maxLon: number, maxLat: number];
  /** Cells per row. */
  width: number;
  /** Number of rows. */
  height: number;
  m_per_cell_x: number;
  m_per_cell_y: number;
  lon_convention: '-180..180';
  nodata: number;
  crs: 'EPSG:4326';
  /** Row 0 is the north edge. */
  row0: 'north';
  dtype: 'float32le';
  source?: string;
  /**
   * Optional. `true` when Data/GIS also ships `sand.bin`: one Uint8 per cell, row-major, same size
   * as the grid, 1 = sand (Routing makes it cost 2×), 0 = not sand. Absent or `false` = no sand layer.
   */
  sand_layer?: boolean;
}

// --- missions.json ---

export interface Mission {
  /** Stable identifier, e.g. `"mro-hirise"`. */
  id: string;
  name: string;
  instrument: string;
  agency: string;
  link: string;
  description?: string;
}

// --- targets.geojson ---

export interface TargetProps {
  id: string;
  name: string;
  why: string;
  /** `Mission.id` of the mission that revealed the target. */
  mission: string;
  mock?: boolean;
}

export type Target = Feature<Point, TargetProps>;
export type TargetsCollection = FeatureCollection<Point, TargetProps>;

// --- conditions.json (MEDA) ---

/** A variable with data for the sol: min, mean and max over the sol. */
export interface ConditionStats {
  status: 'ok';
  unit: string;
  min: number;
  mean: number;
  max: number;
  /** Number of valid records used. */
  n: number;
  level: 'derived' | 'calibrated';
  /** PDS product, e.g. `"DER_PS"`. */
  product: string;
  column: string;
}

/** A variable without data: never filled with an invented value. */
export interface ConditionUnavailable {
  status: 'unavailable';
  reason: string;
}

export type ConditionVariable = ConditionStats | ConditionUnavailable;

export interface SolConditions {
  sol: number;
  /** Start and end of the data of the sol, UTC, from the PDS label. */
  utc_start: string;
  utc_end: string;
  variables: {
    pressure: ConditionVariable;
    air_temperature: ConditionVariable;
    relative_humidity: ConditionVariable;
    wind: ConditionVariable;
    dust: ConditionVariable;
  };
}

export interface Conditions {
  source: {
    mission: string;
    /** `Mission.id` in `missions.json`. */
    mission_id: string;
    instrument: string;
    bundle: string;
    /** PDS release the data came from, e.g. `"mars2020_meda-20260811"`. */
    release: string;
    doi: string;
    url: string;
    note: string;
  };
  /** Most recent sol in the file (the data is not live). */
  latest_sol: number;
  /** Sols, latest first. */
  sols: SolConditions[];
}

// --- route ---

/** One leg of a multi-stop route: from one requested point to the next. */
export interface RouteLeg {
  /** Vertex index (in the LineString) where the leg starts. */
  from_vertex: number;
  /** Vertex index where the leg ends (the next stop). */
  to_vertex: number;
  dist_m: number;
  time_s: number;
  o2_kg: number;
}

export interface RouteProps {
  dist_m: number;
  time_s: number;
  o2_kg: number;
  /** `[cumulative distance in m, elevation in m]` pairs; the last one has `dist_m`. */
  profile: [dist_m: number, elev_m: number][];
  /** One entry per pair of consecutive requested points; their sums equal `dist_m`, `time_s` and `o2_kg`. */
  legs?: RouteLeg[];
  verdict?: 'GO' | 'NO-GO';
  /**
   * Index (in the LineString) of the FIRST vertex from which the astronaut can no longer get back
   * to the habitat (the route's first point) with the O₂ left, by the least-O₂ way home.
   * The last safe vertex is this index − 1.
   * Present only when `verdict` is `'NO-GO'`.
   */
  point_of_no_return?: number;
  mock?: boolean;
}

export type Route = Feature<LineString, RouteProps>;

// --- state ---

export type RouteStatus = 'idle' | 'computing' | 'ready' | 'error';
export type LayerId = string;
