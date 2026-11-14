import type { LonLat } from '../lib/mars-geo';
import type { RouteProps } from '../types/contract';

/** Versioned key: bump the suffix when the stored shape changes (old data is then ignored). */
export const SAVED_ROUTES_KEY = 'martian-map.saved-routes.v1';

/** Minimal `Storage` subset, so tests can inject a fake and blocked storage can be simulated. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Key figures of the route at save time (shown in the list without recomputing). */
export interface SavedRouteSummary {
  dist_m: number;
  time_s: number;
  o2_kg: number;
  verdict?: RouteProps['verdict'];
}

export interface SavedRoute {
  id: string;
  name: string;
  waypoints: LonLat[];
  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
  summary: SavedRouteSummary | null;
}

interface Envelope {
  version: 1;
  routes: SavedRoute[];
}

/** The browser's `localStorage`, or null when unavailable or blocked. */
export function getBrowserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function isLonLat(v: unknown): v is LonLat {
  return Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]);
}

function parseSummary(v: unknown): SavedRouteSummary | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (!isNum(o.dist_m) || !isNum(o.time_s) || !isNum(o.o2_kg)) return null;
  const s: SavedRouteSummary = { dist_m: o.dist_m, time_s: o.time_s, o2_kg: o.o2_kg };
  if (o.verdict === 'GO' || o.verdict === 'NO-GO') s.verdict = o.verdict;
  return s;
}

function parseRoute(v: unknown): SavedRoute | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.name !== 'string') return null;
  if (typeof o.createdAt !== 'string' || typeof o.updatedAt !== 'string') return null;
  if (!Array.isArray(o.waypoints) || !o.waypoints.every(isLonLat)) return null;
  return {
    id: o.id,
    name: o.name,
    waypoints: o.waypoints.map(([lon, lat]) => [lon, lat] as LonLat),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    summary: parseSummary(o.summary),
  };
}

/** Lists saved routes (oldest first). Corrupt, unknown-version or blocked storage gives `[]`. */
export function listSavedRoutes(storage: StorageLike | null): SavedRoute[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(SAVED_ROUTES_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return [];
    const env = data as Record<string, unknown>;
    if (env.version !== 1 || !Array.isArray(env.routes)) return [];
    return env.routes.flatMap((r) => {
      const parsed = parseRoute(r);
      return parsed ? [parsed] : [];
    });
  } catch {
    return [];
  }
}

/** Writes the whole list. Returns false when the write failed (blocked or full storage). */
function writeAll(storage: StorageLike | null, routes: SavedRoute[]): boolean {
  if (!storage) return false;
  try {
    const env: Envelope = { version: 1, routes };
    storage.setItem(SAVED_ROUTES_KEY, JSON.stringify(env));
    return true;
  } catch {
    return false;
  }
}

export function getSavedRoute(storage: StorageLike | null, id: string): SavedRoute | undefined {
  return listSavedRoutes(storage).find((r) => r.id === id);
}

export function saveRoute(
  storage: StorageLike | null,
  input: { name: string; waypoints: LonLat[]; summary: SavedRouteSummary | null },
  now: Date = new Date(),
): SavedRoute | null {
  const ts = now.toISOString();
  const route: SavedRoute = {
    id: newId(),
    name: input.name,
    waypoints: input.waypoints.map(([lon, lat]) => [lon, lat] as LonLat),
    createdAt: ts,
    updatedAt: ts,
    summary: input.summary,
  };
  return writeAll(storage, [...listSavedRoutes(storage), route]) ? route : null;
}

/** Applies `patch` to one route and bumps `updatedAt`. Returns the updated route, or null. */
export function patchSavedRoute(
  storage: StorageLike | null,
  id: string,
  patch: Partial<Pick<SavedRoute, 'name' | 'waypoints' | 'summary'>>,
  now: Date = new Date(),
): SavedRoute | null {
  const all = listSavedRoutes(storage);
  const i = all.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const next: SavedRoute = { ...all[i], ...patch, updatedAt: now.toISOString() };
  all[i] = next;
  return writeAll(storage, all) ? next : null;
}

export function renameSavedRoute(storage: StorageLike | null, id: string, name: string): SavedRoute | null {
  return patchSavedRoute(storage, id, { name });
}

export function removeSavedRoute(storage: StorageLike | null, id: string): boolean {
  const all = listSavedRoutes(storage);
  const rest = all.filter((r) => r.id !== id);
  if (rest.length === all.length) return false;
  return writeAll(storage, rest);
}
