import { describe, expect, it } from 'vitest';
import type { Route } from '../types/contract';
import { DEFAULT_O2_AVAILABLE_KG } from './core/walk';
import { buildTimeline, simulationStateAt } from './simulation';

/** Straight line of 5 vertices, 100 m apart, with a hill, so segments have different costs. */
function makeRoute(extra: Partial<Route['properties']> = {}): Route {
  const lonStep = 0.001;
  const coordinates: [number, number][] = [0, 1, 2, 3, 4].map((k) => [77 + k * lonStep, 18]);
  const elev = [-2500, -2490, -2470, -2480, -2500];
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates },
    properties: {
      dist_m: 400,
      time_s: 600,
      o2_kg: 0.2,
      profile: elev.map((e, k) => [k * 100, e] as [number, number]),
      ...extra,
    },
  };
}

describe('buildTimeline', () => {
  it('starts at zero and ends exactly at the route totals', () => {
    const tl = buildTimeline(makeRoute());
    expect(tl.time_s[0]).toBe(0);
    expect(tl.o2_kg[0]).toBe(0);
    expect(tl.time_s.at(-1)).toBe(600);
    expect(tl.o2_kg.at(-1)).toBe(0.2);
    for (let i = 1; i < tl.time_s.length; i++) expect(tl.time_s[i]!).toBeGreaterThan(tl.time_s[i - 1]!);
  });

  it('makes uphill segments slower than downhill ones', () => {
    const tl = buildTimeline(makeRoute());
    const dt = (i: number) => tl.time_s[i + 1]! - tl.time_s[i]!;
    expect(dt(1)).toBeGreaterThan(dt(3)); // +20 m climb vs. -20 m descent
  });
});

describe('simulationStateAt', () => {
  it('is at the first vertex with nothing spent at t = 0', () => {
    const r = makeRoute();
    const s = simulationStateAt(buildTimeline(r), r, 0);
    expect(s.lonlat).toEqual([77, 18]);
    expect(s.dist_m).toBe(0);
    expect(s.elapsed_s).toBe(0);
    expect(s.o2_used_kg).toBe(0);
    expect(s.o2_left_kg).toBe(DEFAULT_O2_AVAILABLE_KG);
    expect(s.finished).toBe(false);
    expect(s.pastPointOfNoReturn).toBe(false);
  });

  it('matches the route totals at the end within 1%', () => {
    const r = makeRoute();
    const s = simulationStateAt(buildTimeline(r), r, 1e9);
    expect(s.finished).toBe(true);
    expect(s.lonlat[0]).toBeCloseTo(77.004, 9);
    expect(Math.abs(s.elapsed_s - 600) / 600).toBeLessThan(0.01);
    expect(Math.abs(s.o2_used_kg - 0.2) / 0.2).toBeLessThan(0.01);
    expect(Math.abs(s.dist_m - 400) / 400).toBeLessThan(0.01);
  });

  it('clamps negative and non-finite times to the start', () => {
    const r = makeRoute();
    const tl = buildTimeline(r);
    expect(simulationStateAt(tl, r, -50).elapsed_s).toBe(0);
    expect(simulationStateAt(tl, r, Number.NaN).elapsed_s).toBe(0);
  });

  it('interpolates between vertices', () => {
    const r = makeRoute();
    const tl = buildTimeline(r);
    const mid = (tl.time_s[1]! + tl.time_s[2]!) / 2;
    const s = simulationStateAt(tl, r, mid);
    expect(s.vertexIndex).toBe(1);
    expect(s.lonlat[0]).toBeCloseTo(77.0015, 9);
    expect(s.dist_m).toBeCloseTo(150, 9);
    expect(s.o2_used_kg).toBeCloseTo((tl.o2_kg[1]! + tl.o2_kg[2]!) / 2, 12);
  });

  it('never reports negative O₂ left, even when the route needs more than is available', () => {
    const r = makeRoute({ o2_kg: 5 });
    const tl = buildTimeline(r);
    for (const t of [0, 100, 300, 599, 600, 10_000]) {
      const s = simulationStateAt(tl, r, t);
      expect(s.o2_left_kg).toBeGreaterThanOrEqual(0);
      expect(s.o2_left_fraction).toBeGreaterThanOrEqual(0);
    }
    expect(simulationStateAt(tl, r, 600).o2_left_kg).toBe(0);
  });

  it('flags the point of no return once it is reached on a NO-GO route', () => {
    const r = makeRoute({ verdict: 'NO-GO', point_of_no_return: 2 });
    const tl = buildTimeline(r);
    expect(simulationStateAt(tl, r, tl.time_s[2]! - 1).pastPointOfNoReturn).toBe(false);
    expect(simulationStateAt(tl, r, tl.time_s[2]!).pastPointOfNoReturn).toBe(true);
    expect(simulationStateAt(tl, r, 600).pastPointOfNoReturn).toBe(true);
  });

  it('never flags the point of no return on a GO route', () => {
    const r = makeRoute({ verdict: 'GO' });
    expect(simulationStateAt(buildTimeline(r), r, 600).pastPointOfNoReturn).toBe(false);
  });
});
