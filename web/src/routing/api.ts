import type { LonLat } from '../lib/mars-geo';
import type { Route } from '../types/contract';
import type { RouteFailureReason } from './core/errors';
import type { EvaParams } from './core/walk';

/**
 * Message from the main thread to the Worker. `id` grows with every request. `habitat` is where the
 * way home leads (the `habitat` feature of `targets.geojson`); without it, the route's first point.
 */
export type RouteRequest = { id: number; points: LonLat[]; params?: EvaParams; habitat?: LonLat };

/**
 * Worker response; returns the same `id` as the request. FROZEN output format (S6): four states.
 * - `ok: true`: the route (contract `Route`).
 * - `no-path`: no walkable path, or a point on impassable terrain (`point_index` says which).
 * - `out-of-grid`: a point outside the terrain grid (`point_index` says which).
 * - `error`: anything else (e.g. the grid failed to load).
 * `message` is ready to show to the user. One example of each: `public/data/mock/response-*.json`.
 */
export type RouteResponse =
  | { id: number; ok: true; route: Route }
  | { id: number; ok: false; reason: RouteFailureReason; message: string; point_index?: number };

/**
 * Route function signature. The Routing workstream replaces `routeImpl`
 * (in `route.worker.ts`) with the real `route()` (#37/#38) without touching the map.
 */
export type RouteFn = (points: LonLat[], params?: EvaParams, habitat?: LonLat) => Route | Promise<Route>;

/** Errors thrown by the route function (defined in the core), one per failure state. */
export { BlockedPointError, NO_PATH_MESSAGE, NoPathError, OutOfGridError } from './core/errors';
export type { RouteFailureReason } from './core/errors';

/** Old response discarded because a newer request was already made (or the client was cancelled). */
export class StaleRouteError extends Error {
  constructor() {
    super('Route response discarded (newer request in progress)');
    this.name = 'StaleRouteError';
  }
}
