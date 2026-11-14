import type { LonLat } from '../lib/mars-geo';
import type { Route } from '../types/contract';
import { NoPathError, StaleRouteError, type RouteRequest, type RouteResponse } from './api';
import { RequestTracker } from './requestTracker';

export interface RouteClient {
  /** Pede a rota; rejeita com `StaleRouteError` se um pedido mais novo foi feito, ou `NoPathError`. */
  route(points: LonLat[]): Promise<Route>;
  /** Invalida o pedido em andamento (a resposta, se vier, é descartada). */
  cancel(): void;
  /** Termina o Worker e rejeita os pedidos pendentes. */
  terminate(): void;
}

interface Pending {
  resolve: (r: Route) => void;
  reject: (e: Error) => void;
}

/** Encapsula o Web Worker de rota. Só o último pedido vence; respostas antigas são descartadas. */
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
  worker.onerror = (e) => rejectAll(() => new Error(e.message || 'Erro no Worker de rota'));

  return {
    route(points) {
      const id = tracker.next();
      // Pedidos anteriores ainda sem resposta ficam obsoletos agora.
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
