/**
 * EVA simulation (issue #62): where the astronaut is, and how much time and O₂ have been spent,
 * at any moment of a route. Pure logic, no React or Leaflet.
 *
 * ASSUMPTION (approximation): the route only carries totals (`time_s`, `o2_kg`) plus a per-vertex
 * elevation profile, so the per-segment split is derived from the routing walk model
 * (`segmentCost` + `DEFAULT_WALK`) and then SCALED so the cumulative values end exactly at the
 * route totals. The shape of the timeline is therefore model-derived, never measured data, and it
 * stays consistent with the totals whatever walk parameters produced the route.
 */
import type { LonLat } from '../lib/mars-geo';
import type { Route } from '../types/contract';
import { DEFAULT_O2_AVAILABLE_KG, DEFAULT_WALK, segmentCost } from './core/walk';

/** Cumulative values at each route vertex (all arrays have one entry per vertex, first = 0). */
export interface Timeline {
  /** Elapsed EVA time at each vertex (s). Last = `route.properties.time_s`. */
  time_s: number[];
  /** O₂ used at each vertex (kg). Last = `route.properties.o2_kg`. */
  o2_kg: number[];
  /** Distance along the route at each vertex (m), from the elevation profile. */
  dist_m: number[];
}

export interface SimulationState {
  /** Interpolated position `[lon, lat]` (longitude −180 to 180). */
  lonlat: LonLat;
  /** Index of the last vertex already reached. */
  vertexIndex: number;
  dist_m: number;
  elapsed_s: number;
  o2_used_kg: number;
  /** O₂ remaining, never negative. */
  o2_left_kg: number;
  /** Remaining O₂ as a fraction of the available amount (0 to 1). */
  o2_left_fraction: number;
  /** `true` once the point of no return has been reached (only NO-GO routes with `point_of_no_return`). */
  pastPointOfNoReturn: boolean;
  /** `true` when the end of the route has been reached. */
  finished: boolean;
}

/** Scales `weights` so they sum to `total`, then accumulates them (first entry 0). */
function cumulativeScaled(weights: number[], total: number, fallback: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const usable = sum > 0 && Number.isFinite(sum);
  const src = usable ? weights : fallback;
  const srcSum = usable ? sum : src.reduce((a, b) => a + b, 0);
  const out = [0];
  let acc = 0;
  for (const w of src) {
    acc += srcSum > 0 ? (w / srcSum) * total : 0;
    out.push(acc);
  }
  // Remove floating-point drift: the last value is exactly the route total.
  if (out.length > 1) out[out.length - 1] = total;
  return out;
}

/** Per-vertex cumulative time, O₂ and distance, ending exactly at the route's totals. */
export function buildTimeline(route: Route): Timeline {
  const { profile, time_s, o2_kg } = route.properties;
  const n = route.geometry.coordinates.length;
  const dist: number[] = [];
  const distDeltas: number[] = [];
  const timeW: number[] = [];
  const o2W: number[] = [];
  for (let i = 0; i < n; i++) {
    dist.push(profile[i]?.[0] ?? 0);
    if (i === 0) continue;
    const d = Math.max(0, dist[i]! - dist[i - 1]!);
    const dz = (profile[i]?.[1] ?? 0) - (profile[i - 1]?.[1] ?? 0);
    const c = segmentCost(d, dz, DEFAULT_WALK);
    distDeltas.push(d);
    timeW.push(c.time_s);
    o2W.push(c.o2_kg);
  }
  return {
    time_s: cumulativeScaled(timeW, time_s, distDeltas),
    o2_kg: cumulativeScaled(o2W, o2_kg, distDeltas),
    dist_m: dist,
  };
}

/**
 * State of the EVA `t_s` seconds after departure. `t_s` is clamped to [0, route time].
 * `o2AvailableKg` defaults to the routing assumption `DEFAULT_O2_AVAILABLE_KG`.
 */
export function simulationStateAt(
  timeline: Timeline,
  route: Route,
  t_s: number,
  o2AvailableKg: number = DEFAULT_O2_AVAILABLE_KG,
): SimulationState {
  const coords = route.geometry.coordinates;
  const last = coords.length - 1;
  const total = timeline.time_s[last] ?? 0;
  const t = Number.isFinite(t_s) ? Math.min(total, Math.max(0, t_s)) : 0;

  // Segment i spans vertices i and i+1; find the last vertex with time <= t (binary search).
  let lo = 0;
  let hi = last;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (timeline.time_s[mid]! <= t) lo = mid;
    else hi = mid - 1;
  }
  const i = lo;
  const finished = t >= total;

  let lonlat: LonLat;
  let dist_m: number;
  let o2Used: number;
  if (i >= last || coords[i + 1] === undefined) {
    const c = coords[last] ?? [0, 0];
    lonlat = [c[0], c[1]];
    dist_m = timeline.dist_m[last] ?? 0;
    o2Used = timeline.o2_kg[last] ?? 0;
  } else {
    const t0 = timeline.time_s[i]!;
    const t1 = timeline.time_s[i + 1]!;
    const f = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
    const a = coords[i]!;
    const b = coords[i + 1]!;
    // Linear interpolation in lon/lat: segments are ~20 m, far below the curvature scale.
    lonlat = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    dist_m = timeline.dist_m[i]! + (timeline.dist_m[i + 1]! - timeline.dist_m[i]!) * f;
    o2Used = timeline.o2_kg[i]! + (timeline.o2_kg[i + 1]! - timeline.o2_kg[i]!) * f;
  }

  const pnr = route.properties.point_of_no_return;
  const pastPointOfNoReturn =
    route.properties.verdict === 'NO-GO' &&
    pnr !== undefined &&
    pnr >= 0 &&
    pnr <= last &&
    t >= (timeline.time_s[pnr] ?? Infinity);

  const o2Left = Math.max(0, o2AvailableKg - o2Used);
  return {
    lonlat,
    vertexIndex: i,
    dist_m,
    elapsed_s: t,
    o2_used_kg: o2Used,
    o2_left_kg: o2Left,
    o2_left_fraction: o2AvailableKg > 0 ? Math.min(1, o2Left / o2AvailableKg) : 0,
    pastPointOfNoReturn,
    finished,
  };
}
