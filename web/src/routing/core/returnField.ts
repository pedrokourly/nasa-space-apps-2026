/**
 * Optimal return: for every cell, the least O₂ (kg) needed to walk from that cell back to the
 * habitat, over passable cells. One backward Dijkstra from the habitat over the whole grid.
 *
 * Edge cost = O₂ of walking from a cell to its neighbor, with the same walking model and the same
 * haversine step length between cell centers that `route()` uses, so `route()`'s cumulative O₂ and
 * this field are measured in the same units. Blocked cells and corner cutting follow the A* rules.
 */
import { haversine } from '../../lib/mars-geo';
import { NEIGHBORS } from './astar';
import { BLOCKED, buildCostGrid, DEFAULT_PROFILE, type CostProfile } from './cost';
import { cellIndex, cellToLonLat, type Cell, type Grid } from './grid';
import { MinHeap } from './heap';
import { DEFAULT_WALK, segmentCost, type WalkProfile } from './walk';

/**
 * Least O₂ (kg) from each cell back to `home` (row-major). `Infinity` = blocked or no way home.
 * Walking is direction-dependent (climbing costs more), so this is the cost of going TO home.
 */
export function returnCostField(
  grid: Grid,
  home: Cell,
  cost: CostProfile = DEFAULT_PROFILE,
  walk: WalkProfile = DEFAULT_WALK,
): Float64Array {
  const { meta } = grid;
  const { width, height } = meta;
  const costs = buildCostGrid(grid, cost);
  const field = new Float64Array(width * height).fill(Infinity);
  const done = new Uint8Array(width * height);
  const h = cellIndex(meta, home.col, home.row);
  if (costs[h] === BLOCKED) return field;

  // Step length (m) to each neighbor depends only on the row (cells are evenly spaced in lon/lat).
  const stepLen = new Float64Array(height * NEIGHBORS.length);
  for (let row = 0; row < height; row++) {
    const a = cellToLonLat(meta, 0, row);
    NEIGHBORS.forEach(([dc, dr], k) => {
      stepLen[row * NEIGHBORS.length + k] = haversine(a, cellToLonLat(meta, dc, row + dr));
    });
  }

  const heap = new MinHeap();
  field[h] = 0;
  heap.push(h, 0);
  while (heap.size > 0) {
    const v = heap.pop();
    if (done[v]) continue;
    done[v] = 1;
    const vc = v % width;
    const vr = (v - vc) / width;
    for (let k = 0; k < NEIGHBORS.length; k++) {
      const [dc, dr] = NEIGHBORS[k]!;
      const uc = vc + dc;
      const ur = vr + dr;
      if (uc < 0 || uc >= width || ur < 0 || ur >= height) continue;
      const u = ur * width + uc;
      if (done[u] || costs[u] === BLOCKED) continue;
      if (dc !== 0 && dr !== 0 && (costs[vr * width + uc] === BLOCKED || costs[ur * width + vc] === BLOCKED)) continue;
      // Walking u → v: the step from row ur in direction (−dc, −dr); length is symmetric.
      const d = stepLen[vr * NEIGHBORS.length + k]!;
      const o2 = segmentCost(d, grid.elevation[v]! - grid.elevation[u]!, walk).o2_kg;
      const nd = field[v]! + o2;
      if (nd < field[u]!) {
        field[u] = nd;
        heap.push(u, nd);
      }
    }
  }
  return field;
}

/** The optimal way home traced over a return field, with its totals. */
export interface ReturnTrace {
  /** Cells from `from` (inclusive) to the habitat (inclusive). */
  cells: Cell[];
  dist_m: number;
  time_s: number;
  o2_kg: number;
}

/**
 * Follows `field` (from `returnCostField`) downhill from `from` to the habitat: at each cell it steps
 * to the neighbor `n` that minimizes `O₂(cur → n) + field[n]`, the same choice the field's Dijkstra
 * made, so no new search is needed. Uses the same neighbors, blocked-cell and corner-cutting rules as
 * A* and the field, and the same step length and walking model as `route()`.
 *
 * Returns `null` when there is no way home (`from` blocked or cut off) or the field is inconsistent
 * (a step that does not strictly lower the field, or more steps than cells).
 */
export function traceReturnPath(
  grid: Grid,
  field: Float64Array,
  from: Cell,
  cost: CostProfile = DEFAULT_PROFILE,
  walk: WalkProfile = DEFAULT_WALK,
): ReturnTrace | null {
  const { meta } = grid;
  const { width, height } = meta;
  const costs = buildCostGrid(grid, cost);
  let cur = cellIndex(meta, from.col, from.row);
  if (!Number.isFinite(field[cur]!)) return null;

  const cells: Cell[] = [{ col: from.col, row: from.row }];
  let dist_m = 0;
  let time_s = 0;
  let o2_kg = 0;
  for (let steps = 0; field[cur]! > 0; steps++) {
    if (steps >= width * height) return null;
    const col = cur % width;
    const row = (cur - col) / width;
    const a = cellToLonLat(meta, col, row);
    let best = -1;
    let bestScore = Infinity;
    let bestD = 0;
    let bestSeg = { time_s: 0, o2_kg: 0 };
    for (const [dc, dr] of NEIGHBORS) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc < 0 || nc >= width || nr < 0 || nr >= height) continue;
      const n = nr * width + nc;
      if (costs[n] === BLOCKED || !Number.isFinite(field[n]!)) continue;
      if (dc !== 0 && dr !== 0 && (costs[row * width + nc] === BLOCKED || costs[nr * width + col] === BLOCKED)) continue;
      const d = haversine(a, cellToLonLat(meta, nc, nr));
      const seg = segmentCost(d, grid.elevation[n]! - grid.elevation[cur]!, walk);
      const score = seg.o2_kg + field[n]!;
      if (score < bestScore) {
        best = n;
        bestScore = score;
        bestD = d;
        bestSeg = seg;
      }
    }
    // Every step must strictly lower the field; otherwise the trace could loop.
    if (best < 0 || !(field[best]! < field[cur]!)) return null;
    dist_m += bestD;
    time_s += bestSeg.time_s;
    o2_kg += bestSeg.o2_kg;
    cur = best;
    cells.push({ col: cur % width, row: (cur - (cur % width)) / width });
  }
  return { cells, dist_m, time_s, o2_kg };
}
