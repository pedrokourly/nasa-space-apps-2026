import type { Route } from '../types/contract';
import type { LonLat } from '../lib/mars-geo';

export interface ProfilePoint {
  /** Position of the vertex on the route, as `[lon, lat]`. */
  lonlat: LonLat;
  /** Cumulative distance from the start, in meters. */
  dist_m: number;
  /** Elevation at the vertex, in meters. */
  elev_m: number;
}

/**
 * Route point matching index `i` of the elevation profile.
 * Per the contract (AGENTS.md, section 5), `profile[i]` describes vertex `i` of the LineString.
 * Returns `null` for an invalid index or an inconsistent route, without throwing.
 */
export function profilePointAt(route: Route | null, i: number | null | undefined): ProfilePoint | null {
  if (!route || i === null || i === undefined || !Number.isInteger(i) || i < 0) return null;
  const coord = route.geometry.coordinates[i];
  const profile = route.properties.profile[i];
  if (!coord || !profile) return null;
  return { lonlat: [coord[0], coord[1]], dist_m: profile[0], elev_m: profile[1] };
}
