import type { Meta, Mission, Route, TargetsCollection } from '../types/contract';

export interface AppData {
  meta: Meta;
  targets: TargetsCollection;
  missions: Mission[];
}

export type DataSource = 'mock' | 'real';

function fail(arquivo: string, msg: string): never {
  throw new Error(`Dado inválido em ${arquivo}: ${msg}`);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function checkLonLat(arquivo: string, c: unknown): void {
  if (!Array.isArray(c) || c.length < 2 || !isNum(c[0]) || !isNum(c[1])) {
    fail(arquivo, 'coordenada deve ser [lon, lat] numérico');
  }
  if (c[0] < -180 || c[0] > 180) fail(arquivo, `longitude ${c[0]} fora de −180..180`);
  if (c[1] < -90 || c[1] > 90) fail(arquivo, `latitude ${c[1]} fora de −90..90`);
}

/** Valida minimamente `meta.json` e devolve tipado. */
export function parseMeta(raw: unknown): Meta {
  const f = 'meta.json';
  if (!isObj(raw)) return fail(f, 'esperado objeto');
  const { bbox } = raw;
  if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(isNum)) fail(f, 'bbox deve ter 4 números');
  checkLonLat(f, [bbox[0], bbox[1]]);
  checkLonLat(f, [bbox[2], bbox[3]]);
  for (const k of ['width', 'height', 'm_per_cell_x', 'm_per_cell_y', 'nodata'] as const) {
    if (!isNum(raw[k])) fail(f, `campo ${k} ausente ou não numérico`);
  }
  if (raw.lon_convention !== '-180..180') fail(f, "lon_convention deve ser '-180..180'");
  if (raw.crs !== 'EPSG:4326') fail(f, "crs deve ser 'EPSG:4326'");
  if (raw.row0 !== 'north') fail(f, "row0 deve ser 'north'");
  if (raw.dtype !== 'float32le') fail(f, "dtype deve ser 'float32le'");
  return raw as unknown as Meta;
}

/** Valida `missions.json`. */
export function parseMissions(raw: unknown): Mission[] {
  const f = 'missions.json';
  if (!Array.isArray(raw)) return fail(f, 'esperada lista');
  for (const m of raw) {
    if (!isObj(m)) return fail(f, 'entrada deve ser objeto');
    for (const k of ['id', 'nome', 'instrumento', 'agencia', 'link'] as const) {
      if (typeof m[k] !== 'string' || m[k] === '') fail(f, `campo ${k} ausente`);
    }
  }
  return raw as unknown as Mission[];
}

/** Valida `targets.geojson`. */
export function parseTargets(raw: unknown): TargetsCollection {
  const f = 'targets.geojson';
  if (!isObj(raw) || raw.type !== 'FeatureCollection' || !Array.isArray(raw.features)) {
    return fail(f, 'esperada FeatureCollection');
  }
  for (const ft of raw.features) {
    if (!isObj(ft) || !isObj(ft.geometry) || !isObj(ft.properties)) return fail(f, 'feature malformada');
    if (ft.geometry.type !== 'Point') fail(f, 'geometria deve ser Point');
    checkLonLat(f, ft.geometry.coordinates);
    for (const k of ['id', 'nome', 'por_que', 'missao'] as const) {
      if (typeof ft.properties[k] !== 'string' || ft.properties[k] === '') fail(f, `propriedade ${k} ausente`);
    }
  }
  return raw as unknown as TargetsCollection;
}

/** Valida uma rota (Feature LineString). */
export function parseRoute(raw: unknown): Route {
  const f = 'route.geojson';
  if (!isObj(raw) || raw.type !== 'Feature' || !isObj(raw.geometry) || !isObj(raw.properties)) {
    return fail(f, 'esperada Feature');
  }
  if (raw.geometry.type !== 'LineString' || !Array.isArray(raw.geometry.coordinates)) {
    return fail(f, 'geometria deve ser LineString');
  }
  for (const c of raw.geometry.coordinates) checkLonLat(f, c);
  for (const k of ['dist_m', 'tempo_s', 'o2_kg'] as const) {
    if (!isNum(raw.properties[k])) fail(f, `propriedade ${k} ausente ou não numérica`);
  }
  if (!Array.isArray(raw.properties.perfil)) fail(f, 'propriedade perfil ausente');
  return raw as unknown as Route;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao carregar ${url} (HTTP ${res.status})`);
  return res.json();
}

/** Carrega meta, alvos e missões de `data/mock/` ou `data/` (mesma origem). */
export async function loadData(source: DataSource): Promise<AppData> {
  const base = `${import.meta.env.BASE_URL}data/${source === 'mock' ? 'mock/' : ''}`;
  const [meta, targets, missions] = await Promise.all([
    fetchJson(`${base}meta.json`),
    fetchJson(`${base}targets.geojson`),
    fetchJson(`${base}missions.json`),
  ]);
  return { meta: parseMeta(meta), targets: parseTargets(targets), missions: parseMissions(missions) };
}

/** Carrega a rota mock no formato do contrato. */
export async function loadMockRoute(): Promise<Route> {
  return parseRoute(await fetchJson(`${import.meta.env.BASE_URL}data/mock/route.geojson`));
}
