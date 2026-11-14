import type { LonLat } from '../lib/mars-geo';
import type { Route } from '../types/contract';
import { NoPathError, StaleRouteError, type RouteRequest, type RouteResponse } from './api';
import { RequestTracker } from './requestTracker';

export interface RouteClient {
  /** Requests the route; rejects with `StaleRouteError` if a newer request was made, or `NoPathError`. */
  route(points: LonLat[]): Promise<Route>;
  /** Invalidates the request in flight (its response, if it arrives, is discarded). */
  cancel(): void;
  /** Terminates the Worker and rejects pending requests. */
  terminate(): void;
}

interface Pending {
  resolve: (r: Route) => void;
  reject: (e: Error) => void;
}

/** Wraps the route Web Worker. Only the latest request wins; old responses are discarded. */
export function createRouteClient(): RouteClient {
  const worker = new Worker(new URL('./route.worker.ts', import.meta.url), { type: 'module' });
  const tracker = new RequestTracker();
  const pending = new Map<number, Pending>();

  const rejectAll = (err: () => Error) => {
    pending.forEach((p) => p.reject(err()));
    pending.clear();
  };

  worker.onmessage = (e: MessageEvent<RouteResponse>) => {
    const res = e.data;
    const p = pending.get(res.id);
    if (!p) return;
    pending.delete(res.id);
    if (!tracker.isCurrent(res.id)) p.reject(new StaleRouteError());
    else if (res.ok) p.resolve(res.route);
    else p.reject(res.reason === 'no-path' ? new NoPathError(res.message) : new Error(res.message));
  };
  worker.onerror = (e) => rejectAll(() => new Error(e.message || 'Route Worker error'));

  return {
    route(points) {
      const id = tracker.next();
      // Earlier requests still without a response become stale now.
      rejectAll(() => new StaleRouteError());
      return new Promise<Route>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        const req: RouteRequest = { id, points };
        worker.postMessage(req);
      });
    },
    cancel() {
      tracker.next();
      rejectAll(() => new StaleRouteError());
    },
    terminate() {
      rejectAll(() => new StaleRouteError());
      worker.terminate();
    },
  };
}
