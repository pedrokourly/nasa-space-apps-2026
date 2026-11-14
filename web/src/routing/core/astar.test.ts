import { describe, expect, it } from 'vitest';
import { findPath, findPathDijkstra } from './astar';
import { buildCostGrid, DEFAULT_PROFILE, cellFactor } from './cost';
import {
  buildMockGrid,
  craterGrid,
  flatGrid,
  holesGrid,
  MOCK_STEEP_DEG,
  sandPatchGrid,
  wallWithGapGrid,
} from './mockGrid';

/** Deterministic PRNG (mulberry32) for reproducible tests. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('cost function', () => {
  it('slope >= 25° blocks; below it costs more than flat', () => {
    const g = buildMockGrid(3, 1, (col) => ({ slope: [0, 24.9, 25][col]! }));
    expect(cellFactor(g, 0, DEFAULT_PROFILE)).toBe(1);
    const f = cellFactor(g, 1, DEFAULT_PROFILE);
    expect(f).toBeGreaterThan(1);
    expect(Number.isFinite(f)).toBe(true);
    expect(cellFactor(g, 2, DEFAULT_PROFILE)).toBe(Infinity);
  });

  it('a no-data cell blocks (never becomes zero)', () => {
    const g = holesGrid(3, 1, [[1, 0]]);
    const costs = buildCostGrid(g);
    expect(costs[1]).toBe(Infinity);
    expect(costs[0]).toBe(1);
  });

  it('sand costs 2× the same terrain without sand', () => {
    const g = sandPatchGrid(2, 1, { col0: 1, col1: 1, row0: 0, row1: 0 });
    expect(cellFactor(g, 1, DEFAULT_PROFILE)).toBeCloseTo(2 * cellFactor(g, 0, DEFAULT_PROFILE), 10);
  });

  it('rejects a profile that would cost less than flat', () => {
    expect(() => buildCostGrid(flatGrid(2, 2), { ...DEFAULT_PROFILE, sandMultiplier: 0.5 })).toThrow();
  });
});

describe('A* on test terrains', () => {
  it('flat grid: straight line has the expected length', () => {
    const g = flatGrid(11, 11, 20);
    const r = findPath(g, { col: 0, row: 5 }, { col: 10, row: 5 })!;
    expect(r.cells).toHaveLength(11);
    expect(r.length_m).toBeCloseTo(200, 6);
    expect(r.cost).toBeCloseTo(200, 6);
  });

  it('wall with a gap: the path crosses the wall only through the gap', () => {
    const g = wallWithGapGrid(21, 21, 3);
    const r = findPath(g, { col: 0, row: 18 }, { col: 20, row: 18 })!;
    expect(r).not.toBeNull();
    const crossings = r.cells.filter((c) => c.col === 10);
    expect(crossings).toEqual([{ col: 10, row: 3 }]);
  });

  it('wall without a gap: there is no path', () => {
    const g = buildMockGrid(9, 9, (col) => (col === 4 ? { slope: MOCK_STEEP_DEG } : {}));
    expect(findPath(g, { col: 0, row: 4 }, { col: 8, row: 4 })).toBeNull();
  });

  it('does not cut the corner diagonally between two obstacles', () => {
    // Obstacles at (1,0) and (0,1): going from (0,0) to (1,1) diagonally would cut the corner.
    const g = buildMockGrid(3, 3, (col, row) => ((col === 1 && row === 0) || (col === 0 && row === 1) ? { slope: 40 } : {}));
    expect(findPath(g, { col: 0, row: 0 }, { col: 1, row: 1 })).toBeNull();
  });

  it('crater: goes around without stepping on it and costs more than the straight line', () => {
    const g = craterGrid(31, 31, 8);
    const r = findPath(g, { col: 0, row: 15 }, { col: 30, row: 15 })!;
    for (const c of r.cells) {
      expect(Math.hypot(c.col - 15, c.row - 15)).toBeGreaterThan(8);
    }
    expect(r.length_m).toBeGreaterThan(30 * 20);
  });

  it('sand: goes around a small sand rectangle when the detour is cheap', () => {
    const g = sandPatchGrid(21, 21, { col0: 9, col1: 11, row0: 9, row1: 11 });
    const r = findPath(g, { col: 0, row: 10 }, { col: 20, row: 10 })!;
    const sand = g.sand!;
    expect(r.cells.some((c) => sand[c.row * 21 + c.col] === 1)).toBe(false);
  });

  it('sand: crosses it when there is no way around', () => {
    const g = sandPatchGrid(7, 1, { col0: 3, col1: 3, row0: 0, row1: 0 });
    const r = findPath(g, { col: 0, row: 0 }, { col: 6, row: 0 })!;
    expect(r.cells).toHaveLength(7);
    expect(r.cost).toBeGreaterThan(r.length_m);
  });

  it('hole (no data) on the way: detours; blocked start, goal or island: null', () => {
    const g = holesGrid(9, 9, [[4, 4]]);
    const r = findPath(g, { col: 0, row: 4 }, { col: 8, row: 4 })!;
    expect(r.cells.some((c) => c.col === 4 && c.row === 4)).toBe(false);

    expect(findPath(g, { col: 4, row: 4 }, { col: 8, row: 4 })).toBeNull();
    expect(findPath(g, { col: 0, row: 4 }, { col: 4, row: 4 })).toBeNull();

    const ring = holesGrid(5, 5, [[1, 1], [2, 1], [3, 1], [1, 2], [3, 2], [1, 3], [2, 3], [3, 3]]);
    expect(findPath(ring, { col: 0, row: 0 }, { col: 2, row: 2 })).toBeNull();
  });

  it('start equals goal: one-cell path and cost 0', () => {
    const r = findPath(flatGrid(3, 3), { col: 1, row: 1 }, { col: 1, row: 1 })!;
    expect(r.cells).toEqual([{ col: 1, row: 1 }]);
    expect(r.cost).toBe(0);
  });

  it('outside the grid throws RangeError', () => {
    expect(() => findPath(flatGrid(3, 3), { col: -1, row: 0 }, { col: 1, row: 1 })).toThrow(RangeError);
  });

  it('rectangular cells: uses different m_per_cell_x and m_per_cell_y', () => {
    const g = flatGrid(3, 3);
    g.meta.m_per_cell_x = 10;
    g.meta.m_per_cell_y = 30;
    const horiz = findPath(g, { col: 0, row: 0 }, { col: 2, row: 0 })!;
    const vert = findPath(g, { col: 0, row: 0 }, { col: 0, row: 2 })!;
    expect(horiz.length_m).toBeCloseTo(20, 6);
    expect(vert.length_m).toBeCloseTo(60, 6);
  });
});

describe('A* matches Dijkstra', () => {
  it('same cost on 40 random grids with slope, sand and holes', () => {
    const rand = rng(2026);
    let comparados = 0;
    for (let n = 0; n < 40; n++) {
      const w = 20 + Math.floor(rand() * 10);
      const h = 20 + Math.floor(rand() * 10);
      const g = buildMockGrid(
        w,
        h,
        () => {
          const r = rand();
          if (r < 0.04) return null;
          return { slope: rand() * 30, sand: rand() < 0.2 };
        },
        { withSand: true, cellM: 10 + rand() * 20 },
      );
      const start = { col: Math.floor(rand() * w), row: Math.floor(rand() * h) };
      const goal = { col: Math.floor(rand() * w), row: Math.floor(rand() * h) };
      const a = findPath(g, start, goal);
      const d = findPathDijkstra(g, start, goal);
      if (d === null) {
        expect(a).toBeNull();
      } else {
        expect(a).not.toBeNull();
        expect(a!.cost).toBeCloseTo(d.cost, 6);
        comparados++;
      }
    }
    expect(comparados).toBeGreaterThan(10);
  });
});

describe('performance on 512 × 512', () => {
  const LIMIT_MS = 1000;

  it('flat grid, corner to corner, in under 1 s', () => {
    const g = flatGrid(512, 512, 20);
    const t0 = performance.now();
    const r = findPath(g, { col: 0, row: 0 }, { col: 511, row: 511 });
    const ms = performance.now() - t0;
    expect(r).not.toBeNull();
    expect(ms).toBeLessThan(LIMIT_MS);
  });

  it('grid with slope, sand and 8% random obstacles, in under 1 s', () => {
    const rand = rng(7);
    const g = buildMockGrid(
      512,
      512,
      (col, row) => {
        if ((col === 0 && row === 0) || (col === 511 && row === 511)) return {}; // start and goal free
        return rand() < 0.08 ? { slope: MOCK_STEEP_DEG } : { slope: rand() * 20, sand: rand() < 0.2 };
      },
      { withSand: true },
    );
    const t0 = performance.now();
    const r = findPath(g, { col: 0, row: 0 }, { col: 511, row: 511 });
    const ms = performance.now() - t0;
    // With 8% scattered obstacles (fixed seed) a path exists; the test requires finding it.
    expect(r).not.toBeNull();
    expect(ms).toBeLessThan(LIMIT_MS);
  });
});
