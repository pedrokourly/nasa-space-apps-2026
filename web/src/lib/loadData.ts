import type { Meta, Mission, Route, TargetsCollection } from '../types/contract';

export interface AppData {
  meta: Meta;
  targets: TargetsCollection;
  missions: Mission[];
}

export type DataSource = 'mock' | 'real';

function fail(file: string, msg: string): never {
  throw new Error(`Invalid data in ${file}: ${msg}`);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function checkLonLat(file: string, c: unknown): void {
  if (!Array.isArray(c) || c.length < 2 || !isNum(c[0]) || !isNum(c[1])) {
    fail(file, 'coordinate must be a numeric [lon, lat]');
  }
  if (c[0] < -180 || c[0] > 180) fail(file, `longitude ${c[0]} outside −180..180`);
  if (c[1] < -90 || c[1] > 90) fail(file, `latitude ${c[1]} outside −90..90`);
}

/** Minimally validates `meta.json` and returns it typed. */
export function parseMeta(raw: unknown): Meta {
  const f = 'meta.json';
  if (!isObj(raw)) return fail(f, 'expected an object');
  const { bbox } = raw;
  if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(isNum)) fail(f, 'bbox must have 4 numbers');
  checkLonLat(f, [bbox[0], bbox[1]]);
  checkLonLat(f, [bbox[2], bbox[3]]);
  for (const k of ['width', 'height', 'm_per_cell_x', 'm_per_cell_y', 'nodata'] as const) {
    if (!isNum(raw[k])) fail(f, `field ${k} is missing or not numeric`);
  }
  if (raw.lon_convention !== '-180..180') fail(f, "lon_convention must be '-180..180'");
  if (raw.crs !== 'EPSG:4326') fail(f, "crs must be 'EPSG:4326'");
  if (raw.row0 !== 'north') fail(f, "row0 must be 'north'");
  if (raw.dtype !== 'float32le') fail(f, "dtype must be 'float32le'");
  return raw as unknown as Meta;
}

/** Validates `missions.json`. */
export function parseMissions(raw: unknown): Mission[] {
  const f = 'missions.json';
  if (!Array.isArray(raw)) return fail(f, 'expected a list');
  for (const m of raw) {
    if (!isObj(m)) return fail(f, 'entry must be an object');
    for (const k of ['id', 'name', 'instrument', 'agency', 'link'] as const) {
      if (typeof m[k] !== 'string' || m[k] === '') fail(f, `field ${k} is missing`);
    }
  }
  return raw as unknown as Mission[];
}

/** Validates `targets.geojson`. */
export function parseTargets(raw: unknown): TargetsCollection {
  const f = 'targets.geojson';
  if (!isObj(raw) || raw.type !== 'FeatureCollection' || !Array.isArray(raw.features)) {
    return fail(f, 'expected a FeatureCollection');
  }
  for (const ft of raw.features) {
    if (!isObj(ft) || !isObj(ft.geometry) || !isObj(ft.properties)) return fail(f, 'malformed feature');
    if (ft.geometry.type !== 'Point') fail(f, 'geometry must be a Point');
    checkLonLat(f, ft.geometry.coordinates);
    for (const k of ['id', 'name', 'why', 'mission'] as const) {
      if (typeof ft.properties[k] !== 'string' || ft.properties[k] === '') fail(f, `property ${k} is missing`);
    }
  }
  return raw as unknown as TargetsCollection;
}

/** Validates a route (LineString Feature). */
export function parseRoute(raw: unknown): Route {
  const f = 'route.geojson';
  if (!isObj(raw) || raw.type !== 'Feature' || !isObj(raw.geometry) || !isObj(raw.properties)) {
    return fail(f, 'expected a Feature');
  }
  if (raw.geometry.type !== 'LineString' || !Array.isArray(raw.geometry.coordinates)) {
    return fail(f, 'geometry must be a LineString');
  }
  for (const c of raw.geometry.coordinates) checkLonLat(f, c);
  for (const k of ['dist_m', 'time_s', 'o2_kg'] as const) {
    if (!isNum(raw.properties[k])) fail(f, `property ${k} is missing or not numeric`);
  }
  if (!Array.isArray(raw.properties.profile)) fail(f, 'property profile is missing');
  return raw as unknown as Route;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url} (HTTP ${res.status})`);
  return res.json();
}

/** Loads meta, targets and missions from `data/mock/` or `data/` (same origin). */
export async function loadData(source: DataSource): Promise<AppData> {
  const base = `${import.meta.env.BASE_URL}data/${source === 'mock' ? 'mock/' : ''}`;
  const [meta, targets, missions] = await Promise.all([
    fetchJson(`${base}meta.json`),
    fetchJson(`${base}targets.geojson`),
    fetchJson(`${base}missions.json`),
  ]);
  return { meta: parseMeta(meta), targets: parseTargets(targets), missions: parseMissions(missions) };
}

/** Loads the mock route in the contract format. */
export async function loadMockRoute(): Promise<Route> {
  return parseRoute(await fetchJson(`${import.meta.env.BASE_URL}data/mock/route.geojson`));
}
