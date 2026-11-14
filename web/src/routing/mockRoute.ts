import { haversine, type LonLat } from '../lib/mars-geo';
import type { Route } from '../types/contract';

/*
 * MOCK: the values below are ASSUMPTIONS for the demo, not scientific values.
 * The Routing workstream (#37/#38) replaces them with the real walking and O₂ model.
 */
/** ASSUMPTION/MOCK: constant walking speed (m/s). */
export const MOCK_SPEED_M_S = 1;
/** ASSUMPTION/MOCK: O₂ consumption (kg per hour). */
export const MOCK_O2_KG_PER_H = 0.1;
/** Maximum spacing between path vertices (m), so the profile and hover have resolution. */
export const MOCK_STEP_M = 50;
/** MOCK: deterministic synthetic elevation (m): base + amplitude * sin(2π · dist / wavelength). */
const MOCK_ELEV_BASE_M = -2500;
const MOCK_ELEV_AMPLITUDE_M = 30;
const MOCK_ELEV_WAVELENGTH_M = 600;

function mockElevation(distM: number): number {
  return MOCK_ELEV_BASE_M + MOCK_ELEV_AMPLITUDE_M * Math.sin((2 * Math.PI * distM) / MOCK_ELEV_WAVELENGTH_M);
}

/** Connects the points with straight lines, densified every ~50 m. Pure logic. */
export function mockRoute(points: LonLat[]): Route {
  if (points.length < 2) throw new Error('mockRoute needs at least 2 points');

  const verts: LonLat[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const n = Math.max(1, Math.ceil(haversine(a, b) / MOCK_STEP_M));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      verts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }

  const profile: [number, number][] = [[0, mockElevation(0)]];
  let dist = 0;
  for (let i = 1; i < verts.length; i++) {
    dist += haversine(verts[i - 1]!, verts[i]!);
    profile.push([dist, mockElevation(dist)]);
  }

  const time_s = dist / MOCK_SPEED_M_S;
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: verts },
    properties: {
      dist_m: dist,
      time_s,
      o2_kg: (time_s / 3600) * MOCK_O2_KG_PER_H,
      profile,
      verdict: 'GO',
      mock: true,
    },
  };
}
