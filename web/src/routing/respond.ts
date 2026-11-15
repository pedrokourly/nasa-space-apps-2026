import type { RouteFn, RouteRequest, RouteResponse } from './api';
import { NoPathError, OutOfGridError } from './core/errors';

/**
 * Runs the route function for one request and turns the result, or whatever it throws, into the
 * frozen `RouteResponse`. Never throws. Pure (no Worker APIs), so tests can call it.
 */
export async function answerRoute(
  { id, points, params, habitat, run }: RouteRequest,
  routeImpl: RouteFn,
): Promise<RouteResponse> {
  try {
    return { id, ok: true, route: await routeImpl(points, params, habitat, run) };
  } catch (e) {
    if (e instanceof NoPathError || e instanceof OutOfGridError) {
      return {
        id,
        ok: false,
        reason: e instanceof NoPathError ? 'no-path' : 'out-of-grid',
        message: e.message,
        ...(e.pointIndex !== undefined ? { point_index: e.pointIndex } : {}),
      };
    }
    return { id, ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

/** Rebuilds the error for a failed response on the main-thread side of the Worker. */
export function errorFromResponse(res: Extract<RouteResponse, { ok: false }>): Error {
  if (res.reason === 'no-path') return new NoPathError(res.message, res.point_index);
  if (res.reason === 'out-of-grid') return new OutOfGridError(res.point_index, res.message);
  return new Error(res.message);
}

/** Text for the route status line: known routing failures speak for themselves; the rest get a prefix. */
export function routeErrorText(e: unknown): string {
  if (e instanceof NoPathError || e instanceof OutOfGridError) return e.message;
  return `Route error: ${e instanceof Error ? e.message : String(e)}`;
}
