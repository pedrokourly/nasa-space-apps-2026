import { NoPathError, type RouteFn, type RouteRequest, type RouteResponse } from './api';
import { mockRoute } from './mockRoute';

/**
 * PONTO DE PLUG DO ROTEAMENTO: a frente Roteamento troca `mockRoute` pelo
 * `route()` real (#37/#38) aqui, sem mexer no mapa nem no cliente.
 */
const routeImpl: RouteFn = mockRoute;

/** Atraso artificial (ms) só em dev, para ver "Calculando rota…". Desligado por padrão (VITE_ROUTE_MOCK_DELAY_MS). */
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
