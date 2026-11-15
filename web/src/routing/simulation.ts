/**
 * EVA simulation (issues #62 and #71): where the astronaut is, and how much time and O₂ have been
 * spent, at any moment of the simulated plan. Pure logic, no React or Leaflet.
 *
 * ASSUMPTION (approximation): the route only carries totals (`time_s`, `o2_kg`) plus a per-vertex
 * elevation profile, so the per-segment split is derived from the routing walk model
 * (`segmentCost` + `DEFAULT_WALK`) and then SCALED so the cumulative values end exactly at the
 * route totals. The shape of the timeline is therefore model-derived, never measured data, and it
 * stays consistent with the totals whatever walk parameters produced the route.
 *
 * Plans (issue #71): the simulation walks the drawn route, or the route up to the turn-back vertex
 * followed by the estimated way home (to the habitat or to the start). The route part keeps the
 * per-vertex timeline above; the return part only has totals (`time_s`, `o2_kg`, `dist_m`), so they
 * are spread over its vertices in proportion to the haversine distance (assumption: constant pace
 * and O₂ rate along the return, no slope weighting). The totals of a combined path are exactly the
 * route part plus the return estimate.
 */
import { haversine, type LonLat } from '../lib/mars-geo';
import type { ReturnPath, Route } from '../types/contract';
import { DEFAULT_O2_AVAILABLE_KG, DEFAULT_WALK, segmentCost } from './core/walk';

/** What the EVA simulation walks. */
export type SimPlan = 'route' | 'habitat' | 'start';

export const SIM_PLAN_LABELS: Record<SimPlan, string> = {
  route: 'Planned route',
  habitat: 'Return to habitat',
  start: 'Return to start',
};

/**
 * Cumulative values at each vertex of the simulated path (all arrays have one entry per vertex,
 * first = 0). For the 'route' plan the vertices are the route's; for a return plan they are the
 * route's up to the turn-back vertex followed by the return path's.
 */
export interface Timeline {
  plan: SimPlan;
  /** `[lon, lat]` of each vertex (longitude −180 to 180). */
  coordinates: LonLat[];
  /** Elapsed EVA time at each vertex (s). Last = path total. */
  time_s: number[];
  /** O₂ used at each vertex (kg). Last = path total. */
  o2_kg: number[];
  /** Distance along the path at each vertex (m). */
  dist_m: number[];
  /** Vertex of the point of no return: 'route' plan on a NO-GO route only. */
  pnr_vertex?: number;
  /** Vertex where the astronaut turns back and starts the way home: return plans only. */
  return_start_vertex?: number;
}

/** A simulated path with its cumulative time, O₂ and distance. */
export type SimPath = Timeline;

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
  /** `true` once the point of no return has been reached (only the 'route' plan of a NO-GO route with `point_of_no_return`). */
  pastPointOfNoReturn: boolean;
  /** `true` once the astronaut has started the way home (return plans only). */
  returning: boolean;
  /** `true` when the end of the path has been reached. */
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

/** Per-vertex cumulative time, O₂ and distance of the drawn route, ending exactly at its totals. */
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
  const tl: Timeline = {
    plan: 'route',
    coordinates: route.geometry.coordinates.map((c): LonLat => [c[0], c[1]]),
    time_s: cumulativeScaled(timeW, time_s, distDeltas),
    o2_kg: cumulativeScaled(o2W, o2_kg, distDeltas),
    dist_m: dist,
  };
  const pnr = route.properties.point_of_no_return;
  if (route.properties.verdict === 'NO-GO' && pnr !== undefined && pnr >= 0 && pnr < n) tl.pnr_vertex = pnr;
  return tl;
}

/** The return a plan walks after the route, or `undefined` (route plan, or the return is absent). */
function returnPathOf(route: Route, plan: SimPlan): ReturnPath | undefined {
  if (plan === 'habitat') return route.properties.return_path;
  if (plan === 'start') return route.properties.return_to_start?.return_path;
  return undefined;
}

/** Plans the simulation can walk for `route`: always the route, plus each return that exists. */
export function availablePlans(route: Route | null): SimPlan[] {
  if (!route) return [];
  const plans: SimPlan[] = ['route'];
  if (route.properties.return_path) plans.push('habitat');
  if (route.properties.return_to_start?.return_path) plans.push('start');
  return plans;
}

/** Plan used until the user picks one: the way home to the habitat when it exists, else the route. */
export function defaultPlan(route: Route | null): SimPlan {
  return availablePlans(route).includes('habitat') ? 'habitat' : 'route';
}

/**
 * Simulated path of `plan`. 'route' is `buildTimeline(route)`. A return plan is the route's
 * vertices 0..`return_path.from_vertex` (with the route's own timeline) followed by the return
 * path's vertices; the join vertex is not repeated. The return's `time_s`, `o2_kg` and `dist_m`
 * are spread over its vertices in proportion to the haversine distance (approximation). Falls back
 * to the 'route' path when the plan's return is absent.
 */
export function buildSimPath(route: Route, plan: SimPlan): SimPath {
  const base = buildTimeline(route);
  const ret = returnPathOf(route, plan);
  if (!ret || ret.coordinates.length === 0) return base;

  const from = Math.min(base.coordinates.length - 1, Math.max(0, Math.trunc(ret.from_vertex)));
  const join = base.coordinates[from]!;
  const coordinates = base.coordinates.slice(0, from + 1);
  const time_s = base.time_s.slice(0, from + 1);
  const o2_kg = base.o2_kg.slice(0, from + 1);
  const dist_m = base.dist_m.slice(0, from + 1);

  // The return's first coordinate is normally the join vertex itself: do not repeat it.
  const first = ret.coordinates[0]!;
  const dropFirst = haversine(join, [first[0], first[1]]) < 1;
  const rc = (dropFirst ? ret.coordinates.slice(1) : ret.coordinates).map((c): LonLat => [c[0], c[1]]);
  const steps: number[] = [];
  let prev = join;
  for (const c of rc) {
    steps.push(haversine(prev, c));
    prev = c;
  }
  const sum = steps.reduce((a, b) => a + b, 0);
  const t0 = time_s[from]!;
  const o0 = o2_kg[from]!;
  const d0 = dist_m[from]!;
  let acc = 0;
  rc.forEach((c, k) => {
    acc += sum > 0 ? steps[k]! / sum : 1 / rc.length;
    // The last vertex is exactly the return total (no floating-point drift).
    const f = k === rc.length - 1 ? 1 : Math.min(1, acc);
    coordinates.push(c);
    time_s.push(t0 + ret.time_s * f);
    o2_kg.push(o0 + ret.o2_kg * f);
    dist_m.push(d0 + ret.dist_m * f);
  });
  return { plan, coordinates, time_s, o2_kg, dist_m, return_start_vertex: from };
}

/**
 * State of the EVA `t_s` seconds after departure. `t_s` is clamped to [0, path time].
 * `o2AvailableKg` defaults to the routing assumption `DEFAULT_O2_AVAILABLE_KG`.
 */
export function simulationStateAt(
  timeline: Timeline,
  t_s: number,
  o2AvailableKg: number = DEFAULT_O2_AVAILABLE_KG,
): SimulationState {
  const coords = timeline.coordinates;
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

  const pnr = timeline.pnr_vertex;
  const pastPointOfNoReturn = pnr !== undefined && t >= (timeline.time_s[pnr] ?? Infinity);
  const ret = timeline.return_start_vertex;
  const returning = ret !== undefined && t >= (timeline.time_s[ret] ?? Infinity);

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
    returning,
    finished,
  };
}
