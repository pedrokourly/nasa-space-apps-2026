import { NoPathError, type RouteFn, type RouteRequest, type RouteResponse } from './api';
import { createRouter } from './core/route';
import { loadGrid } from './loadGrid';

/**
 * Where the Worker reads the grid from: the real Jezero grid made by the Data/GIS pipeline
 * (MRO/HiRISE DTM resampled to 512 × 512, see `docs/terrain-data.md`). Its `meta.json` has the same
 * bbox and size as `data/mock/`, so targets and clicks line up. The invented terrain stays in
 * `data/mock/` for tests.
 */
const GRID_BASE_URL = `${import.meta.env.BASE_URL}data/`;

/** Loads the grid once, on the first request. If loading fails, the next request tries again. */
let routerPromise: Promise<RouteFn> | null = null;
function getRouter(): Promise<RouteFn> {
  routerPromise ??= loadGrid(GRID_BASE_URL)
    .then((grid) => createRouter(grid))
    .catch((e: unknown) => {
      routerPromise = null;
      throw e;
    });
  return routerPromise;
}

/** ROUTING PLUG POINT: the real `route()` (A* over the grid, time, O₂, verdict). */
const routeImpl: RouteFn = async (points) => (await getRouter())(points);

/** Artificial delay (ms) in dev only, to see "Computing route…". Off by default (VITE_ROUTE_MOCK_DELAY_MS). */
const DEV_DELAY_MS = import.meta.env.DEV ? Number(import.meta.env.VITE_ROUTE_MOCK_DELAY_MS ?? 0) || 0 : 0;

interface WorkerScope {
  onmessage: ((e: MessageEvent<RouteRequest>) => void) | null;
  postMessage(msg: RouteResponse): void;
}
const ctx = self as unknown as WorkerScope;

async function handle({ id, points }: RouteRequest): Promise<RouteResponse> {
  try {
    if (DEV_DELAY_MS > 0) await new Promise((r) => setTimeout(r, DEV_DELAY_MS));
    const route = await routeImpl(points);
    return { id, ok: true, route };
  } catch (e) {
    if (e instanceof NoPathError) return { id, ok: false, reason: 'no-path', message: e.message };
    return { id, ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

ctx.onmessage = (e) => {
  void handle(e.data).then((res) => ctx.postMessage(res));
};
