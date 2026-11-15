/**
 * Pathfinding on the cost grid: A* (heuristic = straight-line distance in meters) and
 * Dijkstra (the same search without a heuristic), used in tests to check A*.
 * 8 neighbors; a diagonal move is only allowed when both orthogonal cells beside it are free
 * (it does not "cut the corner" of an obstacle).
 */
import { BLOCKED, costGridFor, DEFAULT_PROFILE, type CostProfile } from './cost';
import { cellIndex, inBounds, type Cell, type Grid } from './grid';
import { MinHeap } from './heap';

export interface PathResult {
  /** Path cells, from start to goal (inclusive). */
  cells: Cell[];
  /** Total cost: sum of (step meters × average factor of the two cells). */
  cost: number;
  /** Path length on the grid in meters (without the cost factor). */
  length_m: number;
}

export const NEIGHBORS: ReadonlyArray<readonly [dc: number, dr: number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function search(
  grid: Grid,
  start: Cell,
  goal: Cell,
  profile: CostProfile,
  useHeuristic: boolean,
): PathResult | null {
  const { meta } = grid;
  const { width, height } = meta;
  if (!inBounds(meta, start.col, start.row)) throw new RangeError(`start outside the grid: (${start.col}, ${start.row})`);
  if (!inBounds(meta, goal.col, goal.row)) throw new RangeError(`goal outside the grid: (${goal.col}, ${goal.row})`);

  const costs = costGridFor(grid, profile);
  const s = cellIndex(meta, start.col, start.row);
  const t = cellIndex(meta, goal.col, goal.row);
  if (costs[s] === BLOCKED || costs[t] === BLOCKED) return null;

  const sx = meta.m_per_cell_x;
  const sy = meta.m_per_cell_y;
  const step = NEIGHBORS.map(([dc, dr]) => Math.hypot(dc * sx, dr * sy));
  const h = (col: number, row: number): number =>
    useHeuristic ? Math.hypot((col - goal.col) * sx, (row - goal.row) * sy) : 0;

  const g = new Float64Array(width * height).fill(Infinity);
  const from = new Int32Array(width * height).fill(-1);
  const closed = new Uint8Array(width * height);
  const heap = new MinHeap();
  g[s] = 0;
  heap.push(s, h(start.col, start.row));

  while (heap.size > 0) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === t) break;
    const col = cur % width;
    const row = (cur - col) / width;
    for (let k = 0; k < NEIGHBORS.length; k++) {
      const [dc, dr] = NEIGHBORS[k]!;
      const nc = col + dc;
      const nr = row + dr;
      if (nc < 0 || nc >= width || nr < 0 || nr >= height) continue;
      const ni = nr * width + nc;
      if (closed[ni] || costs[ni] === BLOCKED) continue;
      if (dc !== 0 && dr !== 0 && (costs[row * width + nc] === BLOCKED || costs[nr * width + col] === BLOCKED)) continue;
      const ng = g[cur]! + step[k]! * ((costs[cur]! + costs[ni]!) / 2);
      if (ng < g[ni]!) {
        g[ni] = ng;
        from[ni] = cur;
        heap.push(ni, ng + h(nc, nr));
      }
    }
  }

  if (!closed[t]) return null;

  const cells: Cell[] = [];
  let length_m = 0;
  for (let i = t; i !== -1; i = from[i]!) {
    const col = i % width;
    cells.push({ col, row: (i - col) / width });
  }
  cells.reverse();
  for (let i = 1; i < cells.length; i++) {
    length_m += Math.hypot((cells[i]!.col - cells[i - 1]!.col) * sx, (cells[i]!.row - cells[i - 1]!.row) * sy);
  }
  return { cells, cost: g[t]!, length_m };
}

/** Lowest-cost path between two cells with A*. `null` = no path (or blocked start/goal). Throws `RangeError` if outside the grid. */
export function findPath(grid: Grid, start: Cell, goal: Cell, profile: CostProfile = DEFAULT_PROFILE): PathResult | null {
  return search(grid, start, goal, profile, true);
}

/** The same problem solved by Dijkstra; the reference used to check A*. */
export function findPathDijkstra(grid: Grid, start: Cell, goal: Cell, profile: CostProfile = DEFAULT_PROFILE): PathResult | null {
  return search(grid, start, goal, profile, false);
}
