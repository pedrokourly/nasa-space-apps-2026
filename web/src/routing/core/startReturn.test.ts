/**
 * Issue #69, second verdict: when the route does not start at the habitat, `return_to_start` carries an
 * independent GO / NO-GO, point of no return and way back measured against the route's start point.
 */
import { describe, expect, it } from 'vitest';
import type { LonLat } from '../../lib/mars-geo';
import type { Route } from '../../types/contract';
import { cellIndex, cellToLonLat, lonLatToCell, type Grid } from './grid';
import { buildMockGrid } from './mockGrid';
import { returnCostField } from './returnField';
import { route } from './route';
import { DEFAULT_WALK, segmentCost } from './walk';

const pt = (g: Grid, col: number, row: number): LonLat => cellToLonLat(g.meta, col, row);
const lastOf = <T,>(a: T[]): T => a[a.length - 1]!;

/** O₂ spent from the route's first vertex up to vertex `i`, with the same per-step model as `route()`. */
function o2UpTo(r: Route, i: number): number {
  const prof = r.properties.profile;
  let o2 = 0;
  for (let k = 1; k <= i; k++) {
    o2 += segmentCost(prof[k]![0] - prof[k - 1]![0], prof[k]![1] - prof[k - 1]![1], DEFAULT_WALK).o2_kg;
  }
  return o2;
}

/** Last stop (vertex 0 or a leg end) reached before vertex `pnr`: where a NO-GO return starts. */
const lastStopBefore = (r: Route, pnr: number): number =>
  Math.max(0, ...(r.properties.legs ?? []).map((l) => l.to_vertex).filter((v) => v < pnr));

describe('route(): second verdict against the start point (#69)', () => {
  // Rolling terrain so the walk is direction-dependent; the habitat sits in the south-west corner.
  const g = buildMockGrid(40, 40, (col, row) => ({ elev: -2500 + 6 * Math.sin(col / 5) + 4 * Math.cos(row / 7), slope: 3 }));
  const H = pt(g, 2, 37);
  const S = pt(g, 22, 18);
  const pts = [S, pt(g, 37, 4), pt(g, 30, 30)];
  const startField = returnCostField(g, lonLatToCell(g.meta, S)!);
  const habitatField = returnCostField(g, lonLatToCell(g.meta, H)!);
  /** Least O₂ from route vertex `i` back to the cell of `field`. */
  const homeAt = (r: Route, field: Float64Array, i: number): number => {
    const c = lonLatToCell(g.meta, r.geometry.coordinates[i]!)!;
    return field[cellIndex(g.meta, c.col, c.row)]!;
  };

  it('a start away from the habitat: both verdicts present, the start return ends at the start', () => {
    const r = route(g, pts, { habitat: H, o2_available_kg: 100 });
    const p = r.properties;
    expect(p.verdict).toBe('GO');
    expect(lastOf(p.return_path!.coordinates)).toEqual(H);
    const s = p.return_to_start!;
    expect(s.verdict).toBe('GO');
    expect(s.point_of_no_return).toBeUndefined();
    expect(s.return_path!.from_vertex).toBe(r.geometry.coordinates.length - 1);
    expect(s.return_path!.coordinates[0]).toEqual(lastOf(r.geometry.coordinates));
    expect(lastOf(s.return_path!.coordinates)).toEqual(S);
    expect(s.return_path!.o2_kg).toBeCloseTo(homeAt(r, startField, r.geometry.coordinates.length - 1), 12);
  });

  it('a start at the habitat (or no habitat at all): no return_to_start', () => {
    expect(route(g, pts, { habitat: S, o2_available_kg: 100 }).properties.return_to_start).toBeUndefined();
    expect(route(g, pts, { o2_available_kg: 100 }).properties.return_to_start).toBeUndefined();
    expect(route(g, pts, { habitat: S, o2_available_kg: 0.001 }).properties.return_to_start).toBeUndefined();
  });

  it('start NO-GO: the start return leaves the last stop before the point of no return, ends at the start and fits', () => {
    const full = route(g, pts, { habitat: H, o2_available_kg: 100 }).properties;
    const need = full.o2_kg + full.return_to_start!.return_path!.o2_kg;
    for (const k of [0.2, 0.5, 0.8, 0.99]) {
      const available = need * k;
      const r = route(g, pts, { habitat: H, o2_available_kg: available });
      const s = r.properties.return_to_start!;
      expect(s.verdict).toBe('NO-GO');
      const pnr = s.point_of_no_return!;
      expect(pnr).toBeGreaterThanOrEqual(1);
      const stop = lastStopBefore(r, pnr);
      if (stop === 0) {
        // Turning back at the start itself: nothing to draw.
        expect(s.return_path).toBeUndefined();
        continue;
      }
      const ret = s.return_path!;
      expect(ret.from_vertex).toBe(stop);
      expect(ret.coordinates[0]).toEqual(r.geometry.coordinates[stop]);
      expect(lastOf(ret.coordinates)).toEqual(S);
      // Route up to that stop + the dashed way back to the start fits in the O₂...
      expect(o2UpTo(r, stop) + ret.o2_kg).toBeLessThanOrEqual(available + 1e-12);
      // ...and one vertex further it does not.
      expect(o2UpTo(r, pnr) + homeAt(r, startField, pnr)).toBeGreaterThan(available);
    }
  });

  it('start NO-GO with point of no return 1: no start return (the astronaut never leaves)', () => {
    const r = route(g, pts, { habitat: H, o2_available_kg: 1e-9 });
    const s = r.properties.return_to_start!;
    expect(s).toMatchObject({ verdict: 'NO-GO', point_of_no_return: 1 });
    expect(s.return_path).toBeUndefined();
  });

  it('a loop back to the start: start GO with no start return path', () => {
    const r = route(g, [S, pt(g, 30, 10), S], { habitat: H, o2_available_kg: 100 });
    const s = r.properties.return_to_start!;
    expect(s.verdict).toBe('GO');
    expect(s.return_path).toBeUndefined();
  });

  it('habitat NO-GO while the start is GO: the verdicts are independent', () => {
    // Short trip near the start, habitat far away.
    const near = [pt(g, 34, 6), pt(g, 37, 3)];
    const big = route(g, near, { habitat: H, o2_available_kg: 100 });
    const last = big.geometry.coordinates.length - 1;
    const needStart = big.properties.o2_kg + homeAt(big, startFieldOf(near[0]!), last);
    const needHabitat = big.properties.o2_kg + homeAt(big, habitatField, last);
    expect(needStart).toBeLessThan(needHabitat);
    const p = route(g, near, { habitat: H, o2_available_kg: (needStart + needHabitat) / 2 }).properties;
    expect(p.verdict).toBe('NO-GO');
    expect(p.return_to_start!.verdict).toBe('GO');
    expect(p.return_to_start!.point_of_no_return).toBeUndefined();
  });

  it('start NO-GO while the habitat is GO: a one-way trip that ends near the habitat', () => {
    const oneWay = [pt(g, 37, 3), pt(g, 4, 35)];
    const big = route(g, oneWay, { habitat: H, o2_available_kg: 100 });
    const last = big.geometry.coordinates.length - 1;
    const needStart = big.properties.o2_kg + homeAt(big, startFieldOf(oneWay[0]!), last);
    const needHabitat = big.properties.o2_kg + homeAt(big, habitatField, last);
    expect(needHabitat).toBeLessThan(needStart);
    const p = route(g, oneWay, { habitat: H, o2_available_kg: (needStart + needHabitat) / 2 }).properties;
    expect(p.verdict).toBe('GO');
    expect(p.point_of_no_return).toBeUndefined();
    expect(p.return_to_start!.verdict).toBe('NO-GO');
    expect(p.return_to_start!.point_of_no_return).toBeGreaterThanOrEqual(1);
  });

  /** Return field towards the cell of `p`. */
  function startFieldOf(p: LonLat): Float64Array {
    return returnCostField(g, lonLatToCell(g.meta, p)!);
  }
});
