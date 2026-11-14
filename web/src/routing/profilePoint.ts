import type { Route } from '../types/contract';
import type { LonLat } from '../lib/mars-geo';

export interface ProfilePoint {
  /** Posição do vértice na rota, em `[lon, lat]`. */
  lonlat: LonLat;
  /** Distância acumulada desde a partida, em metros. */
  dist_m: number;
  /** Elevação no vértice, em metros. */
  elev_m: number;
}

/**
 * Ponto da rota correspondente ao índice `i` do perfil de elevação.
 * Pelo contrato (AGENTS.md, seção 5), `perfil[i]` descreve o vértice `i` do LineString.
 * Devolve `null` para índice inválido ou rota inconsistente, sem lançar erro.
 */
export function profilePointAt(route: Route | null, i: number | null | undefined): ProfilePoint | null {
  if (!route || i === null || i === undefined || !Number.isInteger(i) || i < 0) return null;
  const coord = route.geometry.coordinates[i];
  const perfil = route.properties.perfil[i];
  if (!coord || !perfil) return null;
  return { lonlat: [coord[0], coord[1]], dist_m: perfil[0], elev_m: perfil[1] };
}
