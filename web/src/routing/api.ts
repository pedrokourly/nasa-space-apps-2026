import type { LonLat } from '../lib/mars-geo';
import type { Route } from '../types/contract';

/** Message from the main thread to the Worker. `id` grows with every request. */
export type RouteRequest = { id: number; points: LonLat[] };

/** Worker response; returns the same `id` as the request. */
export type RouteResponse =
  | { id: number; ok: true; route: Route }
  | { id: number; ok: false; reason: 'no-path' | 'error'; message: string };

/**
 * Route function signature. The Routing workstream replaces `routeImpl`
 * (in `route.worker.ts`) with the real `route()` (#37/#38) without touching the map.
 */
export type RouteFn = (points: LonLat[]) => Route | Promise<Route>;

/** Default message when no path exists between the points (also shown by the UI as is). */
export const NO_PATH_MESSAGE = 'No possible path between the points';

/** Thrown by the route function when no possible path exists between the points. */
export class NoPathError extends Error {
  constructor(message = NO_PATH_MESSAGE) {
    super(message);
    this.name = 'NoPathError';
  }
}

/** Old response discarded because a newer request was already made (or the client was cancelled). */
export class StaleRouteError extends Error {
  constructor() {
    super('Route response discarded (newer request in progress)');
    this.name = 'StaleRouteError';
  }
}
