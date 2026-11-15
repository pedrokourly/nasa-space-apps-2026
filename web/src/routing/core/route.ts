/**
 * `route()`: connects the requested points with A* over the grid and computes distance, time, O₂,
 * elevation profile, per-leg metrics, point of no return and GO / NO-GO verdict. Pure logic.
 *
 * Conventions:
 * - Line vertices are cell centers (the requested point is "snapped" to its cell).
 * - Distances use `haversine` (R = 3389.5 km), as the contract requires.
 * - The habitat is the first point. The way home from any vertex is the OPTIMAL return: the least-O₂
 *   path from that cell to the habitat (`returnCostField`), not necessarily the way the astronaut came.
 */
import { haversine, type LonLat } from '../../lib/mars-geo';
import type { Route, RouteLeg } from '../../types/contract';
import { findPath } from './astar';
import { BLOCKED, cellFactor, DEFAULT_PROFILE, type CostProfile } from './cost';
import { BlockedPointError, NoPathError, OutOfGridError } from './errors';
import { cellIndex, cellToLonLat, lonLatToCell, type Cell, type Grid } from './grid';
import { returnCostField } from './returnField';
import { DEFAULT_O2_AVAILABLE_KG, DEFAULT_WALK, segmentCost, type EvaParams, type WalkProfile } from './walk';

export interface RouteOptions {
  cost?: CostProfile;
  walk?: WalkProfile;
  /** O₂ available at departure (kg). Default: `DEFAULT_O2_AVAILABLE_KG` (assumption). */
  o2_available_kg?: number;
}

/** Return fields already computed, per grid, keyed by habitat cell and profiles. Small LRU. */
const fieldCache = new WeakMap<Grid, Map<string, Float64Array>>();
const FIELD_CACHE_SIZE = 4;

function cachedReturnField(grid: Grid, home: Cell, cost: CostProfile, walk: WalkProfile): Float64Array {
  let byKey = fieldCache.get(grid);
  if (!byKey) fieldCache.set(grid, (byKey = new Map()));
  const key = `${home.col},${home.row}|${JSON.stringify(cost)}|${JSON.stringify(walk)}`;
  let field = byKey.get(key);
  if (field) {
    byKey.delete(key); // refresh its place in the LRU order
  } else {
    field = returnCostField(grid, home, cost, walk);
    if (byKey.size >= FIELD_CACHE_SIZE) byKey.delete(byKey.keys().next().value!);
  }
  byKey.set(key, field);
  return field;
}

/**
 * Route through all `points`, in order. The first point is the habitat.
 * Throws `OutOfGridError` (point outside the grid), `BlockedPointError` (point on an impassable cell),
 * `NoPathError` (no path between two points) or `Error` (fewer than 2 points).
 * Points that fall in the same cell give a zero-length line with two equal vertices (valid GeoJSON).
 *
 * Verdict: GO if the O₂ of the trip plus the optimal return from its last point (zero when the route
 * ends at the habitat) fits in the available amount.
 *
 * `point_of_no_return`: index of the FIRST vertex from which the astronaut can no longer get back
 * to the habitat with the O₂ left, by the optimal return. The last safe vertex is
 * `point_of_no_return − 1`. Present only when the verdict is NO-GO.
 */
export function route(grid: Grid, points: LonLat[], options: RouteOptions = {}): Route {
  if (points.length < 2) throw new Error('route needs at least 2 points');
  const costProfile = options.cost ?? DEFAULT_PROFILE;
  const walk = options.walk ?? DEFAULT_WALK;
  const available = options.o2_available_kg ?? DEFAULT_O2_AVAILABLE_KG;
  const { meta } = grid;

  const stops: Cell[] = points.map((p, i) => {
    const cell = lonLatToCell(meta, p);
    if (!cell) throw new OutOfGridError(i);
    if (cellFactor(grid, cellIndex(meta, cell.col, cell.row), costProfile) === BLOCKED) throw new BlockedPointError(i);
    return cell;
  });

  const path: Cell[] = [];
  /** Vertex index where each stop sits in the line. */
  const stopVertex: number[] = [0];
  for (let i = 1; i < stops.length; i++) {
    const leg = findPath(grid, stops[i - 1]!, stops[i]!, costProfile);
    if (!leg) throw new NoPathError();
    path.push(...(i === 1 ? leg.cells : leg.cells.slice(1)));
    stopVertex.push(path.length - 1);
  }
  // Every point in the same cell: repeat the vertex so the LineString has the 2 positions GeoJSON requires.
  if (path.length === 1) {
    path.push(path[0]!);
    stopVertex[stopVertex.length - 1] = 1;
  }

  const coords: LonLat[] = path.map((c) => cellToLonLat(meta, c.col, c.row));
  const elev = path.map((c) => grid.elevation[cellIndex(meta, c.col, c.row)]!);

  const profile: [number, number][] = [[0, elev[0]!]];
  // Cumulative distance, time and O₂ at each vertex.
  const cumTime: number[] = [0];
  const fwd: number[] = [0];
  let dist = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = haversine(coords[i - 1]!, coords[i]!);
    const seg = segmentCost(d, elev[i]! - elev[i - 1]!, walk);
    dist += d;
    cumTime.push(cumTime[i - 1]! + seg.time_s);
    fwd.push(fwd[i - 1]! + seg.o2_kg);
    profile.push([dist, elev[i]!]);
  }
  const last = coords.length - 1;

  const legs: RouteLeg[] = [];
  for (let k = 1; k < stopVertex.length; k++) {
    const a = stopVertex[k - 1]!;
    const b = stopVertex[k]!;
    legs.push({
      from_vertex: a,
      to_vertex: b,
      dist_m: profile[b]![0] - profile[a]![0],
      time_s: cumTime[b]! - cumTime[a]!,
      o2_kg: fwd[b]! - fwd[a]!,
    });
  }

  // Least O₂ to get home from vertex i. It can only shrink by what the next step costs (going home
  // through the next vertex is one of the options), so O₂ spent + O₂ home never decreases along the
  // route: once it exceeds what is available it stays above it.
  const field = cachedReturnField(grid, stops[0]!, costProfile, walk);
  const home = (i: number): number => field[cellIndex(meta, path[i]!.col, path[i]!.row)]!;
  const verdict = fwd[last]! + home(last) <= available ? 'GO' : 'NO-GO';

  let pnr: number | undefined;
  if (verdict === 'NO-GO') {
    pnr = last;
    for (let i = 0; i <= last; i++) {
      if (fwd[i]! + home(i) > available) {
        pnr = i;
        break;
      }
    }
  }

  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: {
      dist_m: dist,
      time_s: cumTime[last]!,
      o2_kg: fwd[last]!,
      profile,
      legs,
      verdict,
      ...(pnr !== undefined ? { point_of_no_return: pnr } : {}),
    },
  };
}

/**
 * Binds the grid and options: returns the `(points, params?) => Route` function the Worker expects
 * (`RouteFn`). Optional EVA `params` are merged onto the bound walk profile and O₂ supply.
 */
export function createRouter(
  grid: Grid,
  options: RouteOptions = {},
): (points: LonLat[], params?: Partial<EvaParams>) => Route {
  return (points, params) => {
    if (!params) return route(grid, points, options);
    const walk: WalkProfile = { ...(options.walk ?? DEFAULT_WALK) };
    if (params.speedFlatMS !== undefined) walk.speedFlatMS = params.speedFlatMS;
    if (params.loadMassKg !== undefined) walk.loadMassKg = params.loadMassKg;
    return route(grid, points, { ...options, walk, o2_available_kg: params.o2_available_kg ?? options.o2_available_kg });
  };
}
