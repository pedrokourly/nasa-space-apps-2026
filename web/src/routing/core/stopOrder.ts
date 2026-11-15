/**
 * Best order (#65): visit the stops in the order that uses the least O₂, starting at the habitat (the
 * first point) and counting the cheapest way home from the last stop, without adding a return point. Brute force over every order, which is exact and fast for up to
 * `MAX_ORDER_STOPS` stops (8! = 40,320 orders).
 *
 * The O₂ between every pair of stops comes from the same A* paths `route()` would take, with O₂ summed
 * along each path by the same walking model. The final answer is checked with `route()` itself: if the original order
 * turns out cheaper (paths can tie differently), the original order is kept.
 */
import { haversine, type LonLat } from '../../lib/mars-geo';
import type { Route } from '../../types/contract';
import { findPath } from './astar';
import { DEFAULT_PROFILE, type CostProfile } from './cost';
import { cellIndex, cellToLonLat, lonLatToCell, type Cell, type Grid } from './grid';
import { NoPathError, OutOfGridError } from './errors';
import { cachedReturnField, habitatCell, route, type RouteOptions } from './route';
import { DEFAULT_WALK, segmentCost, type WalkProfile } from './walk';

/** Most stops (not counting the habitat) the brute force accepts. */
export const MAX_ORDER_STOPS = 8;

/**
 * O₂ (kg) to walk from stop i to stop j for every pair, along the path `route()` would take (A* on
 * `cost`). `Infinity` when j cannot be reached from i.
 *
 * The path cost of `cost` is symmetric (step length × average factor of the two cells), so one A* per
 * unordered pair serves both directions; O₂ is direction-dependent and is summed each way.
 */
export function o2Matrix(
  grid: Grid,
  stops: Cell[],
  cost: CostProfile = DEFAULT_PROFILE,
  walk: WalkProfile = DEFAULT_WALK,
): number[][] {
  const { meta } = grid;
  const k = stops.length;
  const m: number[][] = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => (i === j ? 0 : Infinity)));
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const path = findPath(grid, stops[i]!, stops[j]!, cost);
      if (!path) continue;
      let fwd = 0;
      let back = 0;
      for (let q = 1; q < path.cells.length; q++) {
        const u = path.cells[q - 1]!;
        const v = path.cells[q]!;
        const d = haversine(cellToLonLat(meta, u.col, u.row), cellToLonLat(meta, v.col, v.row));
        const dz = grid.elevation[cellIndex(meta, v.col, v.row)]! - grid.elevation[cellIndex(meta, u.col, u.row)]!;
        fwd += segmentCost(d, dz, walk).o2_kg;
        back += segmentCost(d, -dz, walk).o2_kg;
      }
      m[i]![j] = fwd;
      m[j]![i] = back;
    }
  }
  return m;
}

/**
 * Order of the stops that minimizes the O₂ of start (node 0) → every stop → `home`, by exhaustive
 * search with pruning. Stops are every node except 0 and `home`. `home` defaults to 0 (a loop back to
 * the start). Returns the full sequence, e.g. [0, 2, 1, 3, 0] or, with a separate home 4, [0, 2, 1, 3, 4].
 */
export function bestLoopOrder(m: number[][], home = 0): number[] {
  const stops = m.map((_, i) => i).filter((i) => i !== 0 && i !== home);
  const k = stops.length;
  let best = Infinity;
  let bestOrder: number[] = [];
  const used = new Array<boolean>(m.length).fill(false);
  const order: number[] = [];
  const visit = (last: number, spent: number): void => {
    if (spent >= best) return;
    if (order.length === k) {
      const total = spent + m[last]![home]!;
      if (total < best) {
        best = total;
        bestOrder = [...order];
      }
      return;
    }
    for (const j of stops) {
      if (used[j]) continue;
      used[j] = true;
      order.push(j);
      visit(j, spent + m[last]![j]!);
      order.pop();
      used[j] = false;
    }
  };
  visit(0, 0);
  if (!Number.isFinite(best)) throw new NoPathError();
  return [0, ...bestOrder, home];
}

/**
 * Route visiting the stops in the best order (#65). `points[0]` is the habitat and stays first; only
 * the stops after it are reordered, and NO return point is added (a last point in the habitat's cell,
 * if the planner put one, stays last). The order minimizes what the verdict counts: the O₂ of the trip
 * plus the least O₂ to walk home from the last stop, home being `options.habitat` (or the first point). The result carries `stop_order`: indexes into
 * `points`, in visiting order (e.g. [0, 2, 1, 3]).
 * Throws like `route()`, and `Error` above `MAX_ORDER_STOPS` stops.
 */
export function routeBestOrder(grid: Grid, points: LonLat[], options: RouteOptions = {}): Route {
  if (points.length < 2) throw new Error('route needs at least 2 points');
  const { meta } = grid;
  const cells = points.map((p, i) => {
    const c = lonLatToCell(meta, p);
    if (!c) throw new OutOfGridError(i);
    return c;
  });
  const home = cells[0]!;
  const last = cells[cells.length - 1]!;
  const endsHome = cells.length > 2 && last.col === home.col && last.row === home.row;
  const stopIdx = points.map((_, i) => i).slice(1, endsHome ? -1 : undefined);
  if (stopIdx.length > MAX_ORDER_STOPS) {
    throw new Error(`Best order works with up to ${MAX_ORDER_STOPS} stops; this route has ${stopIdx.length}.`);
  }
  const tail = endsHome ? [points.length - 1] : [];
  const original = [0, ...stopIdx, ...tail];
  const toPoints = (order: number[]) => order.map((i) => points[i]!);
  // route() validates every point (outside the grid, impassable) with the right point index.
  const originalRoute = route(grid, toPoints(original), options);

  // Trip + way home: the home node is the real habitat when it differs from the start cell.
  const costProfile = options.cost ?? DEFAULT_PROFILE;
  const homeCell = habitatCell(grid, options.habitat, home, costProfile);
  const separateHome = homeCell.col !== home.col || homeCell.row !== home.row;
  const nodes = [0, ...stopIdx].map((i) => cells[i]!);
  if (separateHome) nodes.push(homeCell);
  const m = o2Matrix(grid, nodes, options.cost, options.walk);
  const seq = bestLoopOrder(m, separateHome ? nodes.length - 1 : 0).slice(0, -1);
  const loop = seq.map((j) => (j === 0 ? 0 : stopIdx[j - 1]!));
  const order = [...loop, ...tail];
  if (order.every((v, i) => v === original[i])) {
    return { ...originalRoute, properties: { ...originalRoute.properties, stop_order: original } };
  }
  const best = route(grid, toPoints(order), options);

  // Check with the real routes: trip O₂ + least O₂ home from the last vertex. Keep the cheaper one.
  const field = cachedReturnField(grid, homeCell, costProfile, options.walk ?? DEFAULT_WALK);
  const needed = (r: Route) => {
    const end = r.geometry.coordinates[r.geometry.coordinates.length - 1]!;
    const c = lonLatToCell(meta, end)!;
    return r.properties.o2_kg + field[cellIndex(meta, c.col, c.row)]!;
  };
  const pick = needed(best) <= needed(originalRoute) ? { r: best, order } : { r: originalRoute, order: original };
  return { ...pick.r, properties: { ...pick.r.properties, stop_order: pick.order } };
}
