import { describe, expect, it } from 'vitest';
import type { LonLat } from '../../lib/mars-geo';
import { answerRoute } from '../respond';
import { DEFAULT_PROFILE, ROUTE_MODES } from './cost';
import { cellIndex, cellToLonLat, lonLatToCell, type Grid } from './grid';
import { buildMockGrid, flatGrid } from './mockGrid';
import { cachedReturnField, createRouter, route } from './route';
import { DEFAULT_WALK, O2_RESERVE_FRACTION } from './walk';
import { sampleGrid } from './sampleRoutes';
import { bestLoopOrder, MAX_ORDER_STOPS, routeBestOrder } from './stopOrder';

const pt = (g: Grid, col: number, row: number): LonLat => cellToLonLat(g.meta, col, row);
const slopesOn = (g: Grid, coords: LonLat[]) =>
  coords.map((c) => {
    const k = lonLatToCell(g.meta, c)!;
    return g.slope[cellIndex(g.meta, k.col, k.row)]!;
  });

describe('route modes', () => {
  // A 22° band blocks the straight line between A and B, except along the bottom rows.
  const g = buildMockGrid(21, 20, (col, row) => (col >= 8 && col <= 12 && row < 15 ? { slope: 22 } : {}));
  const A = pt(g, 0, 5);
  const B = pt(g, 20, 5);
  const router = createRouter(g);

  it('shortest takes the steep shortcut and safest goes around it', () => {
    const shortest = router([A, B], undefined, undefined, { mode: 'shortest' });
    const safest = router([A, B], undefined, undefined, { mode: 'safest' });
    expect(Math.max(...slopesOn(g, shortest.geometry.coordinates))).toBe(22);
    expect(Math.max(...slopesOn(g, safest.geometry.coordinates))).toBe(0);
    expect(safest.properties.dist_m).toBeGreaterThan(shortest.properties.dist_m);
  });

  it('balanced is the default profile', () => {
    expect(router([A, B], undefined, undefined, { mode: 'balanced' })).toEqual(router([A, B]));
  });

  it('every mode keeps factors >= 1 (A* stays optimal) and the 25° ceiling', () => {
    for (const p of Object.values(ROUTE_MODES)) {
      expect(p.sandMultiplier).toBeGreaterThanOrEqual(1);
      expect(p.slopeWeight).toBeGreaterThanOrEqual(0);
      expect(p.maxSlopeDeg).toBeLessThanOrEqual(25);
    }
  });
});

/** What the verdict counts: trip O₂ plus the least O₂ home from the last vertex. */
function needed(g: Grid, pts: LonLat[]): number {
  const r = route(g, pts);
  const home = lonLatToCell(g.meta, pts[0]!)!;
  const end = lonLatToCell(g.meta, r.geometry.coordinates[r.geometry.coordinates.length - 1]!)!;
  return r.properties.o2_kg + cachedReturnField(g, home, DEFAULT_PROFILE, DEFAULT_WALK)[cellIndex(g.meta, end.col, end.row)]!;
}

describe('best order', () => {
  const g = flatGrid(40, 40, 20);
  const H = pt(g, 2, 2);
  const A = pt(g, 30, 2);
  const B = pt(g, 2, 30);
  const C = pt(g, 30, 30);

  it('reorders 4 points given in a bad order, keeps the habitat first and adds no return point', () => {
    const best = routeBestOrder(g, [H, A, B, C]); // A → B crosses the grid diagonally
    const order = best.properties.stop_order!;
    expect(order).toHaveLength(4);
    expect(order[0]).toBe(0);
    expect([[0, 1, 3, 2], [0, 2, 3, 1]]).toContainEqual(order);
    const coords = best.geometry.coordinates;
    expect(coords[coords.length - 1]).not.toEqual(coords[0]); // ends at the last stop, not at home
    expect(needed(g, [H, A, C, B])).toBeLessThan(needed(g, [H, A, B, C]));
  });

  it('a last point the planner put at the habitat stays last', () => {
    const order = routeBestOrder(g, [H, B, A, C, H]).properties.stop_order!;
    expect(order[0]).toBe(0);
    expect(order[order.length - 1]).toBe(4);
    expect([...order.slice(1, -1)].sort()).toEqual([1, 2, 3]);
  });

  it('never needs more O₂ (trip + way home) than the given order (random stops on the sample terrain)', () => {
    const terrain = sampleGrid();
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let n = 0; n < 4; n++) {
      const pts: LonLat[] = [];
      while (pts.length < 5) {
        const c = { col: 20 + Math.floor(rand() * 470), row: 20 + Math.floor(rand() * 470) };
        if (terrain.slope[cellIndex(terrain.meta, c.col, c.row)]! < 20) pts.push(pt(terrain, c.col, c.row));
      }
      const best = routeBestOrder(terrain, pts).properties.stop_order!.map((i) => pts[i]!);
      expect(needed(terrain, best)).toBeLessThanOrEqual(needed(terrain, pts) + 1e-12);
    }
  }, 15_000); // each sample builds a return field over the 512 × 512 sample terrain

  it('the verdict of the reordered route is never worse than the given order', () => {
    const tight = (route(g, [H, A, C, B, H]).properties.o2_kg * 1.01) / (1 - O2_RESERVE_FRACTION); // enough for the good order only (usable share)
    expect(route(g, [H, A, B, C], { o2_available_kg: tight }).properties.verdict).toBe('NO-GO');
    expect(routeBestOrder(g, [H, A, B, C], { o2_available_kg: tight }).properties.verdict).toBe('GO');
  });

  it(`refuses more than ${MAX_ORDER_STOPS} stops with a clear message`, () => {
    const many = [H, ...Array.from({ length: MAX_ORDER_STOPS + 1 }, (_, i) => pt(g, 5 + i * 3, 10))];
    expect(() => routeBestOrder(g, many)).toThrow(/Best order works with up to 8 stops; this route has 9/);
  });

  it('bestLoopOrder finds the cheapest loop on an asymmetric matrix', () => {
    const m = [
      [0, 1, 9, 9],
      [9, 0, 1, 9],
      [9, 9, 0, 1],
      [1, 9, 9, 0],
    ];
    expect(bestLoopOrder(m)).toEqual([0, 1, 2, 3, 0]);
  });

  it('the Worker answer carries stop_order when the best order is requested', async () => {
    const res = await answerRoute({ id: 1, points: [H, A, B, C], run: { optimizeOrder: true } }, createRouter(g));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.route.properties.stop_order).toHaveLength(4);
  });
});
