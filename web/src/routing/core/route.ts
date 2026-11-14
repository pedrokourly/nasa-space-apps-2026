/**
 * `route()`: connects the requested points with A* over the grid and computes distance, time, O₂,
 * elevation profile, point of no return and GO / NO-GO verdict. Pure logic.
 *
 * Conventions:
 * - Line vertices are cell centers (the requested point is "snapped" to its cell).
 * - Distances use `haversine` (R = 3389.5 km), as the contract requires.
 * - Return trip: in this version the way back is along the same path. The optimal return is S5's.
 */
import { haversine, type LonLat } from '../../lib/mars-geo';
import type { Route } from '../../types/contract';
import { findPath } from './astar';
import { DEFAULT_PROFILE, type CostProfile } from './cost';
import { NoPathError, OutOfGridError } from './errors';
import { cellIndex, cellToLonLat, lonLatToCell, type Cell, type Grid } from './grid';
import { DEFAULT_O2_AVAILABLE_KG, DEFAULT_WALK, segmentCost, type WalkProfile } from './walk';

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
 * Verdict: GO if the O₂ of the trip, plus that of the return along the same path when the last
 * point is not the first, fits in the available amount. `point_of_no_return` is the first vertex
 * where the O₂ already spent plus the O₂ to go back the way it came exceeds what is available
 * (absent if that never happens).
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
  const needed = fwd[last]! + (isLoop ? 0 : back[last]!);

  let pnr: number | undefined;
  for (let i = 0; i <= last; i++) {
    if (fwd[i]! + back[i]! > available) {
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

/** Binds the grid and options: returns the `(points) => Route` function the Worker expects (`RouteFn`). */
export function createRouter(grid: Grid, options: RouteOptions = {}): (points: LonLat[]) => Route {
  return (points) => route(grid, points, options);
}
