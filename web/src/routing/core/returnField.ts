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
