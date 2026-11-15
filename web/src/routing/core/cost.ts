/**
 * Per-cell cost function (cost grid). Choosing the weights is the Routing workstream's call:
 * different route modes are just another `CostProfile`, with no change to the data files.
 */
import { isNoData, type Grid } from './grid';

/**
 * Cost model weights.
 * Invariant (for A* to be optimal): `sandMultiplier >= 1` and `slopeWeight >= 0`,
 * i.e. no cell costs less than walking on flat terrain.
 */
export interface CostProfile {
  /** Slope (degrees) at which a cell becomes impassable. */
  maxSlopeDeg: number;
  /** Cost multiplier on sand. */
  sandMultiplier: number;
  /** Weight of the slope term: factor = 1 + slopeWeight * (slope / maxSlopeDeg)². */
  slopeWeight: number;
}

/**
 * Default profile. Project ASSUMPTION (team's initial plan): >= 25° impassable and sand costs 2×.
 * `slopeWeight` is our own hypothesis with no scientific reference; it was checked on the real grid
 * (see "Calibration on the real grid" in `docs/routing-assumptions.md`).
 */
export const DEFAULT_PROFILE: CostProfile = {
  maxSlopeDeg: 25,
  sandMultiplier: 2,
  slopeWeight: 2,
};

/** Route modes the planner can pick (#65). Each is only another cost profile; the data files do not change. */
export type RouteMode = 'balanced' | 'shortest' | 'safest';

/**
 * Cost profile of each route mode. ASSUMPTIONS (ours, no scientific reference):
 * - `balanced`: the default profile above.
 * - `shortest`: distance only (no slope penalty), still never over 25°.
 * - `safest`: stricter limit (20°) and a strong slope penalty (weight 8), so it pays extra distance to
 *   stay on flatter ground. 20° keeps every real demo target reachable (the steepest, the delta front, sits on 13.8°).
 * All keep factors >= 1, so A* stays optimal.
 */
export const ROUTE_MODES: Record<RouteMode, CostProfile> = {
  balanced: DEFAULT_PROFILE,
  shortest: { maxSlopeDeg: 25, sandMultiplier: 2, slopeWeight: 0 },
  safest: { maxSlopeDeg: 20, sandMultiplier: 2, slopeWeight: 8 },
};

/** Cost of a "blocked" cell (impassable or no data). */
export const BLOCKED = Infinity;

/** Validates the profile; throws if it breaks the invariant. */
export function assertProfile(p: CostProfile): void {
  if (!(p.maxSlopeDeg > 0)) throw new Error('maxSlopeDeg must be > 0');
  if (!(p.sandMultiplier >= 1)) throw new Error('sandMultiplier must be >= 1');
  if (!(p.slopeWeight >= 0)) throw new Error('slopeWeight must be >= 0');
}

/**
 * Cost factor of cell `i` (>= 1), or `BLOCKED`.
 * Blocked if: no data in elevation or slope, or slope >= `maxSlopeDeg`.
 * A no-data cell never becomes zero nor "flat".
 */
export function cellFactor(grid: Grid, i: number, profile: CostProfile): number {
  const { meta } = grid;
  const elev = grid.elevation[i]!;
  const slope = grid.slope[i]!;
  if (isNoData(meta, elev) || isNoData(meta, slope)) return BLOCKED;
  if (slope >= profile.maxSlopeDeg) return BLOCKED;
  const ratio = Math.max(0, slope) / profile.maxSlopeDeg;
  let factor = 1 + profile.slopeWeight * ratio * ratio;
  if (grid.sand && grid.sand[i] === 1) factor *= profile.sandMultiplier;
  return factor;
}

/** Cost factor of every cell, row-major. `Infinity` = blocked. */
export function buildCostGrid(grid: Grid, profile: CostProfile = DEFAULT_PROFILE): Float32Array {
  assertProfile(profile);
  const n = grid.meta.width * grid.meta.height;
  const costs = new Float32Array(n);
  for (let i = 0; i < n; i++) costs[i] = cellFactor(grid, i, profile);
  return costs;
}

/** Cost grids already built, per grid and profile. A grid's arrays never change once loaded. */
const costGridCache = new WeakMap<Grid, Map<string, Float32Array>>();

/**
 * Same as `buildCostGrid`, but built once per grid and profile and then reused (building one walks all
 * 262,144 cells, which used to happen on every A* leg). The returned array is shared: never write to it.
 */
export function costGridFor(grid: Grid, profile: CostProfile = DEFAULT_PROFILE): Float32Array {
  let byProfile = costGridCache.get(grid);
  if (!byProfile) costGridCache.set(grid, (byProfile = new Map()));
  const key = `${profile.maxSlopeDeg}|${profile.sandMultiplier}|${profile.slopeWeight}`;
  let costs = byProfile.get(key);
  if (!costs) byProfile.set(key, (costs = buildCostGrid(grid, profile)));
  return costs;
}
