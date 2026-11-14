/**
 * `route()`: connects the requested points with A* over the grid and computes distance, time, O₂,
 * elevation profile, point of no return and GO / NO-GO verdict. Pure logic.
 *
 * Conventions:
 * - Line vertices are cell centers (the requested point is "snapped" to its cell).
 * - Distances use `haversine` (R = 3389.5 km), as the contract requires.
 * - Return trip: back along the same path or, on a loop, forward to the end. The optimal return
 *   (cheapest path home from any cell) is S5's.
 */
import { haversine, type LonLat } from '../../lib/mars-geo';
import type { Route } from '../../types/contract';
import { findPath } from './astar';
import { DEFAULT_PROFILE, type CostProfile } from './cost';
import { NoPathError, OutOfGridError } from './errors';
import { cellIndex, cellToLonLat, lonLatToCell, type Cell, type Grid } from './grid';
import { DEFAULT_O2_AVAILABLE_KG, DEFAULT_WALK, segmentCost, type EvaParams, type WalkProfile } from './walk';

export interface RouteOptions {
  cost?: CostProfile;
  walk?: WalkProfile;
  /** O₂ available at departure (kg). Default: `DEFAULT_O2_AVAILABLE_KG` (assumption). */
  o2_available_kg?: number;
}

/**
 * Route through all `points`, in order.
 * Throws `OutOfGridError` (point outside the grid), `NoPathError` (no path) or `Error` (fewer than 2 points).
 *
 * The habitat is the first point. Verdict: GO if the O₂ of the trip, plus that of the return along
 * the same path when the last point is not the habitat, fits in the available amount.
 *
 * `point_of_no_return`: index of the FIRST vertex from which the astronaut can no longer get back
 * to the habitat with the O₂ left (going back the way they came or, on a loop, carrying on to the
 * end). The last safe vertex is `point_of_no_return − 1`. Present only when the verdict is NO-GO.
 */
export function route(grid: Grid, points: LonLat[], options: RouteOptions = {}): Route {
  if (points.length < 2) throw new Error('route needs at least 2 points');
  const costProfile = options.cost ?? DEFAULT_PROFILE;
  const walk = options.walk ?? DEFAULT_WALK;
  const available = options.o2_available_kg ?? DEFAULT_O2_AVAILABLE_KG;
  const { meta } = grid;

  const stops: Cell[] = points.map((p) => {
    const cell = lonLatToCell(meta, p);
    if (!cell) throw new OutOfGridError(p);
    return cell;
  });

  const path: Cell[] = [];
  for (let i = 1; i < stops.length; i++) {
    const leg = findPath(grid, stops[i - 1]!, stops[i]!, costProfile);
    if (!leg) throw new NoPathError();
    path.push(...(i === 1 ? leg.cells : leg.cells.slice(1)));
  }

  const coords: LonLat[] = path.map((c) => cellToLonLat(meta, c.col, c.row));
  const elev = path.map((c) => grid.elevation[cellIndex(meta, c.col, c.row)]!);

  const profile: [number, number][] = [[0, elev[0]!]];
  // fwd[i] / back[i]: cumulative O₂ going to vertex i / coming back from vertex i to the start.
  const fwd: number[] = [0];
  const back: number[] = [0];
  let dist = 0;
  let time = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = haversine(coords[i - 1]!, coords[i]!);
    const dz = elev[i]! - elev[i - 1]!;
    const go = segmentCost(d, dz, walk);
    const ret = segmentCost(d, -dz, walk);
    dist += d;
    time += go.time_s;
    fwd.push(fwd[i - 1]! + go.o2_kg);
    back.push(back[i - 1]! + ret.o2_kg);
    profile.push([dist, elev[i]!]);
  }

  const last = coords.length - 1;
  const first = stops[0]!;
  const end = stops[stops.length - 1]!;
  const isLoop = first.col === end.col && first.row === end.row;

  // O₂ to get back to the habitat (first point) from vertex i: back along the same path or,
  // when the route itself ends at the habitat, by carrying on to the end, whichever is cheaper.
  const returnFrom = (i: number): number => (isLoop ? Math.min(back[i]!, fwd[last]! - fwd[i]!) : back[i]!);
  // fwd[i] + returnFrom(i) never decreases along the route, so once it exceeds what is
  // available it stays above it: the point of no return exists if and only if the verdict is NO-GO.
  const needed = fwd[last]! + returnFrom(last);

  let pnr: number | undefined;
  for (let i = 0; i <= last; i++) {
    if (fwd[i]! + returnFrom(i) > available) {
      pnr = i;
      break;
    }
  }

  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: {
      dist_m: dist,
      time_s: time,
      o2_kg: fwd[last]!,
      profile,
      verdict: needed <= available ? 'GO' : 'NO-GO',
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
    if (params.o2BaseKgPerH !== undefined) walk.o2BaseKgPerH = params.o2BaseKgPerH;
    return route(grid, points, { ...options, walk, o2_available_kg: params.o2_available_kg ?? options.o2_available_kg });
  };
}
