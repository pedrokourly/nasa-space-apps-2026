/**
 * `route()`: connects the requested points with A* over the grid and computes distance, time, O₂,
 * elevation profile, per-leg metrics, point of no return and GO / NO-GO verdict. Pure logic.
 *
 * Conventions:
 * - Line vertices are cell centers (the requested point is "snapped" to its cell).
 * - Distances use `haversine` (R = 3389.5 km), as the contract requires.
 * - The habitat is `options.habitat` (the app passes the `habitat` feature of `targets.geojson`). When it
 *   is missing, outside the grid or on an impassable cell, the route's first point is the habitat.
 * - The way home from any vertex is the OPTIMAL return: the least-O₂ path from that cell to the habitat
 *   (`returnCostField`), not necessarily the way the astronaut came.
 * - ASSUMPTION: the O₂ budget is counted from the route's first point, with the full supply at
 *   departure, even when that point is not the habitat (the astronaut is taken to start there with a
 *   full supply). See `docs/routing-assumptions.md`.
 */
import { haversine, type LonLat } from '../../lib/mars-geo';
import type { ReturnPath, Route, RouteLeg } from '../../types/contract';
import { findPath } from './astar';
import { BLOCKED, cellFactor, DEFAULT_PROFILE, type CostProfile } from './cost';
import { BlockedPointError, NoPathError, OutOfGridError } from './errors';
import { cellIndex, cellToLonLat, lonLatToCell, type Cell, type Grid } from './grid';
import { returnCostField, traceReturnPath } from './returnField';
import { DEFAULT_O2_AVAILABLE_KG, DEFAULT_WALK, segmentCost, type EvaParams, type WalkProfile } from './walk';

export interface RouteOptions {
  cost?: CostProfile;
  walk?: WalkProfile;
  /** O₂ available at departure (kg). Default: `DEFAULT_O2_AVAILABLE_KG` (assumption). */
  o2_available_kg?: number;
  /**
   * Habitat position `[lon, lat]`: where the way home leads. Default: the route's first point. When it
   * is outside the grid or on an impassable cell, the route's first point is used instead.
   */
  habitat?: LonLat;
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

/** Habitat cell: `habitat` when it is inside the grid and passable, else `fallback` (the first point). */
function habitatCell(grid: Grid, habitat: LonLat | undefined, fallback: Cell, costProfile: CostProfile): Cell {
  if (!habitat) return fallback;
  const cell = lonLatToCell(grid.meta, habitat);
  if (!cell || cellFactor(grid, cellIndex(grid.meta, cell.col, cell.row), costProfile) === BLOCKED) return fallback;
  return cell;
}

/** Verdict, point of no return and way home measured against one home cell. */
interface ReturnVerdict {
  verdict: 'GO' | 'NO-GO';
  pnr?: number;
  returnPath?: ReturnPath;
}

/**
 * GO / NO-GO of the route `path` (cumulative O₂ `fwd` per vertex) against `homeCell`, by the optimal
 * return over its return field `home(i)`:
 * - GO iff `fwd[last] + home(last) <= available`;
 * - NO-GO: point of no return = first vertex with `fwd[i] + home(i) > available`;
 * - way home from the last vertex (GO) or, on NO-GO, from the last STOP reached before the point of
 *   no return (the latest `stopVertex` below `pnr`), which leaves an O₂ margin compared with turning
 *   back at the very last safe vertex; none when `pnr` is 0 or that stop is already `homeCell`.
 */
function returnVerdict(
  grid: Grid,
  path: Cell[],
  stopVertex: number[],
  fwd: number[],
  available: number,
  homeCell: Cell,
  costProfile: CostProfile,
  walk: WalkProfile,
): ReturnVerdict {
  const { meta } = grid;
  const last = path.length - 1;
  // Least O₂ to get from vertex i to the home cell. It can only shrink by what the next step costs
  // (going home through the next vertex is one of the options, whatever fixed cell home is), so
  // O₂ spent + O₂ home never decreases along the route: once it exceeds what is available it stays
  // above it.
  const field = cachedReturnField(grid, homeCell, costProfile, walk);
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

  // Estimated way home drawn on the map, from where the astronaut turns home: the last vertex on a
  // GO route; on a NO-GO one, the last stop reached before the point of no return. Every vertex
  // before `pnr` is safe (O₂ spent + O₂ home never decreases), so that stop is safe too, with some O₂
  // to spare. None when even the start cannot get home (pnr = 0) or that stop is already the home
  // cell. It follows the same field as the verdict, so its O₂ equals `home(from)`.
  let from = last;
  if (pnr !== undefined) {
    from = -1;
    for (const v of stopVertex) if (v < pnr && v > from) from = v;
  }
  const fromCell = from >= 0 ? path[from]! : undefined;
  let returnPath: ReturnPath | undefined;
  if (fromCell && (fromCell.col !== homeCell.col || fromCell.row !== homeCell.row)) {
    const trace = traceReturnPath(grid, field, fromCell, costProfile, walk);
    if (trace && trace.cells.length >= 2) {
      returnPath = {
        from_vertex: from,
        coordinates: trace.cells.map((c) => cellToLonLat(meta, c.col, c.row)),
        dist_m: trace.dist_m,
        time_s: trace.time_s,
        o2_kg: trace.o2_kg,
      };
    }
  }
  return { verdict, ...(pnr !== undefined ? { pnr } : {}), ...(returnPath ? { returnPath } : {}) };
}

/**
 * Route through all `points`, in order, leaving the first point with the full O₂ supply. The way home
 * leads to `options.habitat` (default: the first point).
 * Throws `OutOfGridError` (point outside the grid), `BlockedPointError` (point on an impassable cell),
 * `NoPathError` (no path between two points) or `Error` (fewer than 2 points).
 * Points that fall in the same cell give a zero-length line with two equal vertices (valid GeoJSON).
 *
 * Verdict: GO if the O₂ of the trip plus the optimal return from its last point to the habitat (zero
 * when the route ends at the habitat) fits in the available amount.
 *
 * `point_of_no_return`: index of the FIRST vertex from which the astronaut can no longer get back
 * to the habitat with the O₂ left, by the optimal return. The last safe vertex is
 * `point_of_no_return − 1`. Present only when the verdict is NO-GO. When it is 0, even the start
 * cannot reach the habitat with the O₂ available (or has no way home at all): `start_unreachable` is
 * set and there is no `return_path`.
 *
 * `return_path`: the optimal way home, from vertex `from_vertex` to the habitat. GO: from the last
 * vertex (absent when the route ends at the habitat). NO-GO: from the last stop reached before the
 * point of no return (a vertex in `legs`, or 0 for the start), so the route up to there plus this
 * return fits in the O₂ available with a margin; absent when that stop is the habitat itself.
 *
 * `return_to_start`: when the start cell is not the habitat cell, a second, independent verdict with
 * the same rules against the route's first point: its own GO / NO-GO, point of no return (always ≥ 1,
 * since the start is 0 O₂ from itself) and way back to the start cell. Absent when the route starts
 * at the habitat cell.
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

  // Habitat verdict. The habitat falls back to the first point, so the start verdict below exists only
  // when the start cell is not the habitat cell.
  const habitat = habitatCell(grid, options.habitat, stops[0]!, costProfile);
  const toHabitat = returnVerdict(grid, path, stopVertex, fwd, available, habitat, costProfile, walk);
  const startUnreachable = toHabitat.pnr === 0;
  const start = stops[0]!;
  const toStart =
    start.col !== habitat.col || start.row !== habitat.row
      ? returnVerdict(grid, path, stopVertex, fwd, available, start, costProfile, walk)
      : undefined;

  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: {
      dist_m: dist,
      time_s: cumTime[last]!,
      o2_kg: fwd[last]!,
      profile,
      legs,
      verdict: toHabitat.verdict,
      ...(toHabitat.pnr !== undefined ? { point_of_no_return: toHabitat.pnr } : {}),
      ...(startUnreachable ? { start_unreachable: true as const } : {}),
      ...(toHabitat.returnPath ? { return_path: toHabitat.returnPath } : {}),
      ...(toStart
        ? {
            return_to_start: {
              verdict: toStart.verdict,
              ...(toStart.pnr !== undefined ? { point_of_no_return: toStart.pnr } : {}),
              ...(toStart.returnPath ? { return_path: toStart.returnPath } : {}),
            },
          }
        : {}),
    },
  };
}

/**
 * Binds the grid and options: returns the `(points, params?, habitat?) => Route` function the Worker
 * expects (`RouteFn`). Optional EVA `params` are merged onto the bound walk profile and O₂ supply; an
 * optional `habitat` replaces the bound one.
 */
export function createRouter(
  grid: Grid,
  options: RouteOptions = {},
): (points: LonLat[], params?: Partial<EvaParams>, habitat?: LonLat) => Route {
  return (points, params, habitat) => {
    const opts: RouteOptions = habitat ? { ...options, habitat } : options;
    if (!params) return route(grid, points, opts);
    const walk: WalkProfile = { ...(opts.walk ?? DEFAULT_WALK) };
    if (params.speedFlatMS !== undefined) walk.speedFlatMS = params.speedFlatMS;
    if (params.loadMassKg !== undefined) walk.loadMassKg = params.loadMassKg;
    return route(grid, points, { ...opts, walk, o2_available_kg: params.o2_available_kg ?? opts.o2_available_kg });
  };
}
