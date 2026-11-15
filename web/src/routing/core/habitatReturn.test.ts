/**
 * Issue #69: the verdict, the point of no return and the way home are measured against the real
 * habitat (`RouteOptions.habitat`), not the route's first point, and on a NO-GO route the way home
 * starts at the last safe vertex.
 */
import { describe, expect, it } from 'vitest';
import type { LonLat } from '../../lib/mars-geo';
import type { Route } from '../../types/contract';
import { answerRoute } from '../respond';
import { cellIndex, cellToLonLat, lonLatToCell, type Grid } from './grid';
import { buildMockGrid, flatGrid, MOCK_STEEP_DEG } from './mockGrid';
import { returnCostField } from './returnField';
import { createRouter, route } from './route';
import { DEFAULT_WALK, segmentCost } from './walk';

const pt = (g: Grid, col: number, row: number): LonLat => cellToLonLat(g.meta, col, row);

/** O₂ spent from the route's first vertex up to vertex `i`, with the same per-step model as `route()`. */
function o2UpTo(r: Route, i: number): number {
  const prof = r.properties.profile;
  let o2 = 0;
  for (let k = 1; k <= i; k++) {
    o2 += segmentCost(prof[k]![0] - prof[k - 1]![0], prof[k]![1] - prof[k - 1]![1], DEFAULT_WALK).o2_kg;
  }
  return o2;
}

const lastOf = <T,>(a: T[]): T => a[a.length - 1]!;

/** Last stop (vertex 0 or a leg end) reached before vertex `pnr`: where a NO-GO return starts. */
const lastStopBefore = (r: Route, pnr: number): number =>
  Math.max(0, ...(r.properties.legs ?? []).map((l) => l.to_vertex).filter((v) => v < pnr));

describe('route(): way home to the real habitat (#69)', () => {
  // Rolling terrain so the walk is direction-dependent; the habitat sits in the south-west corner.
  const g = buildMockGrid(40, 40, (col, row) => ({ elev: -2500 + 6 * Math.sin(col / 5) + 4 * Math.cos(row / 7), slope: 3 }));
  const H = pt(g, 2, 37);
  const S = pt(g, 22, 18); // start, far from the habitat
  const B = pt(g, 37, 4);
  const C = pt(g, 30, 30);
  const pts = [S, B, C];
  /** Least O₂ from the start to the habitat. */
  const homeFromStart = returnCostField(g, lonLatToCell(g.meta, H)!)[cellIndex(g.meta, 22, 18)]!;

  it('a start away from the habitat: the return ends at the habitat, not at the first point (GO)', () => {
    const r = route(g, pts, { habitat: H, o2_available_kg: 100 });
    const p = r.properties;
    expect(p.verdict).toBe('GO');
    const ret = p.return_path!;
    expect(ret.from_vertex).toBe(r.geometry.coordinates.length - 1);
    expect(ret.coordinates[0]).toEqual(lastOf(r.geometry.coordinates));
    expect(lastOf(ret.coordinates)).toEqual(H);
    expect(lastOf(ret.coordinates)).not.toEqual(S);
  });

  it('without a habitat option the first point stays the habitat (backward compatible)', () => {
    const ret = route(g, pts, { o2_available_kg: 100 }).properties.return_path!;
    expect(lastOf(ret.coordinates)).toEqual(S);
  });

  it('the verdict counts the way home to the habitat', () => {
    const toHabitat = route(g, pts, { habitat: H, o2_available_kg: 100 }).properties;
    const toStart = route(g, pts, { o2_available_kg: 100 }).properties;
    const need = toHabitat.o2_kg + toHabitat.return_path!.o2_kg;
    expect(need).not.toBeCloseTo(toStart.o2_kg + toStart.return_path!.o2_kg, 6);
    expect(route(g, pts, { habitat: H, o2_available_kg: need * 1.001 }).properties.verdict).toBe('GO');
    expect(route(g, pts, { habitat: H, o2_available_kg: need * 0.999 }).properties.verdict).toBe('NO-GO');
  });

  it('NO-GO: the return starts at the last stop before the point of no return, ends at the habitat and fits', () => {
    const total = route(g, pts, { habitat: H, o2_available_kg: 100 }).properties;
    const need = total.o2_kg + total.return_path!.o2_kg;
    for (const k of [0.4, 0.6, 0.8, 0.95, 0.999]) {
      const available = homeFromStart + (need - homeFromStart) * k;
      const r = route(g, pts, { habitat: H, o2_available_kg: available });
      const p = r.properties;
      expect(p.verdict).toBe('NO-GO');
      const pnr = p.point_of_no_return!;
      expect(pnr).toBeGreaterThanOrEqual(1);
      expect(p.start_unreachable).toBeUndefined();
      const ret = p.return_path!;
      const stop = lastStopBefore(r, pnr);
      expect(ret.from_vertex).toBe(stop);
      expect(ret.coordinates[0]).toEqual(r.geometry.coordinates[stop]);
      expect(lastOf(ret.coordinates)).toEqual(H);
      // Acceptance criterion: route up to that stop + dashed return fits in the O₂, with margin.
      expect(o2UpTo(r, stop) + ret.o2_kg).toBeLessThanOrEqual(available + 1e-12);
      // ...and one vertex further it does not (that is what makes it the point of no return).
      const field = returnCostField(g, lonLatToCell(g.meta, H)!);
      const at = lonLatToCell(g.meta, r.geometry.coordinates[pnr]!)!;
      expect(o2UpTo(r, pnr) + field[cellIndex(g.meta, at.col, at.row)]!).toBeGreaterThan(available);
    }
  });

  it('a start that cannot reach the habitat with the O₂ available: pnr 0, flagged, no return', () => {
    const r = route(g, pts, { habitat: H, o2_available_kg: homeFromStart * 0.9 });
    const p = r.properties;
    expect(p.verdict).toBe('NO-GO');
    expect(p.point_of_no_return).toBe(0);
    expect(p.start_unreachable).toBe(true);
    expect(p.return_path).toBeUndefined();
  });

  it('a habitat walled off from the start: pnr 0, flagged, no return', () => {
    const walled = buildMockGrid(20, 9, (col) => (col === 10 ? { slope: MOCK_STEEP_DEG } : {}));
    const r = route(walled, [pt(walled, 2, 4), pt(walled, 8, 4)], { habitat: pt(walled, 16, 4), o2_available_kg: 100 });
    expect(r.properties).toMatchObject({ verdict: 'NO-GO', point_of_no_return: 0, start_unreachable: true });
    expect(r.properties.return_path).toBeUndefined();
  });

  it('GO routes and NO-GO routes with a reachable start are never flagged', () => {
    for (const k of [0.5, 0.9, 1.5, 5]) {
      const p = route(g, pts, { habitat: H, o2_available_kg: homeFromStart * 3 * k }).properties;
      if (p.verdict === 'GO' || p.point_of_no_return! > 0) expect(p.start_unreachable).toBeUndefined();
      expect(p.point_of_no_return !== undefined).toBe(p.verdict === 'NO-GO');
    }
  });

  it('a habitat outside the grid or on an impassable cell falls back to the first point', () => {
    const f = flatGrid(30, 5, 20);
    const blocked = buildMockGrid(30, 5, (col) => (col === 29 ? { slope: MOCK_STEEP_DEG } : {}));
    const ptsF: LonLat[] = [pt(f, 2, 2), pt(f, 20, 2)];
    const outside = route(f, ptsF, { habitat: [0, 0] }).properties.return_path!;
    expect(lastOf(outside.coordinates)).toEqual(ptsF[0]);
    const onBlocked = route(blocked, ptsF, { habitat: pt(blocked, 29, 2) }).properties.return_path!;
    expect(lastOf(onBlocked.coordinates)).toEqual(ptsF[0]);
  });

  it('createRouter and the Worker answer pass the habitat through', async () => {
    const router = createRouter(g);
    expect(lastOf(router(pts, undefined, H).properties.return_path!.coordinates)).toEqual(H);
    expect(lastOf(router(pts, { o2_available_kg: 100 }, H).properties.return_path!.coordinates)).toEqual(H);
    const res = await answerRoute({ id: 1, points: pts, habitat: H }, router);
    expect(res.ok && lastOf(res.route.properties.return_path!.coordinates)).toEqual(H);
  });
});
