import type { LonLat } from '../lib/mars-geo';
import type { Route } from '../types/contract';

/** Mensagem do thread principal para o Worker. `id` cresce a cada pedido. */
export type RouteRequest = { id: number; points: LonLat[] };

/** Resposta do Worker; devolve o mesmo `id` do pedido. */
export type RouteResponse =
  | { id: number; ok: true; route: Route }
  | { id: number; ok: false; reason: 'no-path' | 'error'; message: string };

/**
 * Assinatura da função de rota. A frente Roteamento substitui `routeImpl`
 * (em `route.worker.ts`) pelo `route()` real (#37/#38) sem mexer no mapa.
 */
export type RouteFn = (points: LonLat[]) => Route | Promise<Route>;

/** Lançado pela função de rota quando não existe caminho possível entre os pontos. */
export class NoPathError extends Error {
  constructor(message = 'Sem caminho possível entre os pontos') {
    super(message);
    this.name = 'NoPathError';
  }
}

/** Resposta antiga descartada porque um pedido mais novo já foi feito (ou o cliente foi cancelado). */
export class StaleRouteError extends Error {
  constructor() {
    super('Resposta de rota descartada (pedido mais novo em andamento)');
    this.name = 'StaleRouteError';
  }
}
