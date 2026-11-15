import { describe, expect, it } from 'vitest';
import type { Route } from '../types/contract';
import { availablePlans, buildSimPath, buildTimeline, defaultPlan, simulationStateAt } from './simulation';

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
    const s = simulationStateAt(buildTimeline(r), 0);
    expect(s.lonlat).toEqual([77, 18]);
    expect(s.dist_m).toBe(0);
    expect(s.elapsed_s).toBe(0);
    expect(s.o2_used_kg).toBe(0);
    expect(s.o2_left_kg).toBe(1);
    expect(s.finished).toBe(false);
    expect(s.pastPointOfNoReturn).toBe(false);
  });

  it('matches the route totals at the end within 1%', () => {
    const r = makeRoute();
    const s = simulationStateAt(buildTimeline(r), 1e9);
    expect(s.finished).toBe(true);
    expect(s.lonlat[0]).toBeCloseTo(77.004, 9);
    expect(Math.abs(s.elapsed_s - 600) / 600).toBeLessThan(0.01);
    expect(Math.abs(s.o2_used_kg - 0.2) / 0.2).toBeLessThan(0.01);
    expect(Math.abs(s.dist_m - 400) / 400).toBeLessThan(0.01);
  });

  it('clamps negative and non-finite times to the start', () => {
    const r = makeRoute();
    const tl = buildTimeline(r);
    expect(simulationStateAt(tl, -50).elapsed_s).toBe(0);
    expect(simulationStateAt(tl, Number.NaN).elapsed_s).toBe(0);
  });

  it('interpolates between vertices', () => {
    const r = makeRoute();
    const tl = buildTimeline(r);
    const mid = (tl.time_s[1]! + tl.time_s[2]!) / 2;
    const s = simulationStateAt(tl, mid);
    expect(s.vertexIndex).toBe(1);
    expect(s.lonlat[0]).toBeCloseTo(77.0015, 9);
    expect(s.dist_m).toBeCloseTo(150, 9);
    expect(s.o2_used_kg).toBeCloseTo((tl.o2_kg[1]! + tl.o2_kg[2]!) / 2, 12);
  });

  it('never reports negative O₂ left, even when the route needs more than is available', () => {
    const r = makeRoute({ o2_kg: 5 });
    const tl = buildTimeline(r);
    for (const t of [0, 100, 300, 599, 600, 10_000]) {
      const s = simulationStateAt(tl, t);
      expect(s.o2_left_kg).toBeGreaterThanOrEqual(0);
      expect(s.o2_left_fraction).toBeGreaterThanOrEqual(0);
    }
    expect(simulationStateAt(tl, 600).o2_left_kg).toBe(0);
  });

  it('flags the point of no return once it is reached on a NO-GO route', () => {
    const r = makeRoute({ verdict: 'NO-GO', point_of_no_return: 2 });
    const tl = buildTimeline(r);
    expect(simulationStateAt(tl, tl.time_s[2]! - 1).pastPointOfNoReturn).toBe(false);
    expect(simulationStateAt(tl, tl.time_s[2]!).pastPointOfNoReturn).toBe(true);
    expect(simulationStateAt(tl, 600).pastPointOfNoReturn).toBe(true);
  });

  it('never flags the point of no return on a GO route', () => {
    const r = makeRoute({ verdict: 'GO' });
    expect(simulationStateAt(buildTimeline(r), 600).pastPointOfNoReturn).toBe(false);
  });

  it('never reports a return on the drawn route', () => {
    const r = makeRoute();
    expect(simulationStateAt(buildTimeline(r), 600).returning).toBe(false);
  });
});

/** Route of 5 vertices (start away from home) plus a return to the habitat and one to the start. */
function makeRouteWithReturns(): Route {
  const route = makeRoute({ verdict: 'GO' });
  const habitat: [number, number][] = [
    [77.004, 18],
    [77.004, 18.001],
    [77.004, 18.002],
    [77.003, 18.002],
  ];
  const home: [number, number][] = [
    [77.002, 18],
    [77.001, 18],
    [77, 18],
  ];
  route.properties.return_path = {
    from_vertex: 4,
    coordinates: habitat,
    dist_m: 320,
    time_s: 500,
    o2_kg: 0.1,
  };
  route.properties.return_to_start = {
    verdict: 'GO',
    return_path: {
      from_vertex: 3,
      coordinates: [[77.003, 18], ...home],
      dist_m: 300,
      time_s: 450,
      o2_kg: 0.09,
    },
  };
  return route;
}

describe('availablePlans / defaultPlan', () => {
  it('offers nothing without a route', () => {
    expect(availablePlans(null)).toEqual([]);
    expect(defaultPlan(null)).toBe('route');
  });

  it('offers only the route when there is no return', () => {
    expect(availablePlans(makeRoute())).toEqual(['route']);
    expect(defaultPlan(makeRoute())).toBe('route');
  });

  it('offers the habitat return when the route has one, and the start return when it has one', () => {
    const r = makeRouteWithReturns();
    expect(availablePlans(r)).toEqual(['route', 'habitat', 'start']);
    expect(defaultPlan(r)).toBe('habitat');
    delete r.properties.return_to_start;
    expect(availablePlans(r)).toEqual(['route', 'habitat']);
  });

  it('offers only the start return when the route has no habitat return', () => {
    const r = makeRouteWithReturns();
    delete r.properties.return_path;
    expect(availablePlans(r)).toEqual(['route', 'start']);
    expect(defaultPlan(r)).toBe('route');
  });
});

describe('buildSimPath', () => {
  it("'route' is identical to buildTimeline", () => {
    const r = makeRouteWithReturns();
    expect(buildSimPath(r, 'route')).toEqual(buildTimeline(r));
  });

  it('falls back to the route when the plan has no return', () => {
    const r = makeRoute();
    expect(buildSimPath(r, 'habitat')).toEqual(buildTimeline(r));
    expect(buildSimPath(r, 'start')).toEqual(buildTimeline(r));
  });

  it.each([
    ['habitat', 4, 0.1, 500, 320],
    ['start', 3, 0.09, 450, 300],
  ] as const)('%s plan ends at its home with route part plus return totals', (plan, from, o2, time, dist) => {
    const r = makeRouteWithReturns();
    const tl = buildTimeline(r);
    const p = buildSimPath(r, plan);
    const ret = plan === 'habitat' ? r.properties.return_path! : r.properties.return_to_start!.return_path!;
    // Ends at the last coordinate of its return path.
    expect(p.coordinates.at(-1)).toEqual(ret.coordinates.at(-1));
    // Route part keeps the route's own timeline; the join vertex is not repeated.
    expect(p.coordinates.slice(0, from + 1)).toEqual(tl.coordinates.slice(0, from + 1));
    expect(p.coordinates).toHaveLength(from + ret.coordinates.length);
    expect(p.time_s.slice(0, from + 1)).toEqual(tl.time_s.slice(0, from + 1));
    expect(p.return_start_vertex).toBe(from);
    // Totals = route part + return estimate (within 1%).
    const expTime = tl.time_s[from]! + time;
    const expO2 = tl.o2_kg[from]! + o2;
    const expDist = tl.dist_m[from]! + dist;
    expect(Math.abs(p.time_s.at(-1)! - expTime) / expTime).toBeLessThan(0.01);
    expect(Math.abs(p.o2_kg.at(-1)! - expO2) / expO2).toBeLessThan(0.01);
    expect(Math.abs(p.dist_m.at(-1)! - expDist) / expDist).toBeLessThan(0.01);
    for (let i = 1; i < p.time_s.length; i++) expect(p.time_s[i]!).toBeGreaterThan(p.time_s[i - 1]!);
    const s = simulationStateAt(p, 1e9);
    expect(s.finished).toBe(true);
    expect(s.lonlat).toEqual(ret.coordinates.at(-1));
    expect(Math.abs(s.elapsed_s - expTime) / expTime).toBeLessThan(0.01);
    expect(Math.abs(s.o2_used_kg - expO2) / expO2).toBeLessThan(0.01);
  });

  it('keeps the join vertex when the return does not start on the route vertex', () => {
    const r = makeRouteWithReturns();
    r.properties.return_path!.coordinates = [
      [77.0041, 18.0005],
      [77.004, 18],
    ];
    const p = buildSimPath(r, 'habitat');
    expect(p.coordinates).toHaveLength(5 + 2);
    expect(p.coordinates.at(-1)).toEqual([77.004, 18]);
  });

  it('spreads the return over its vertices in proportion to the distance', () => {
    const r = makeRouteWithReturns();
    r.properties.return_path!.coordinates = [
      [77.004, 18],
      [77.004, 18.001],
      [77.004, 18.003],
    ];
    const p = buildSimPath(r, 'habitat');
    const t0 = p.time_s[4]!;
    // The second segment is twice as long as the first.
    expect((p.time_s[6]! - p.time_s[5]!) / (p.time_s[5]! - t0)).toBeCloseTo(2, 6);
  });

  it('flags the return start once reached and never the point of no return on a return plan', () => {
    const r = makeRouteWithReturns();
    r.properties.verdict = 'NO-GO';
    r.properties.point_of_no_return = 3;
    const p = buildSimPath(r, 'habitat');
    expect(p.pnr_vertex).toBeUndefined();
    expect(simulationStateAt(p, p.time_s[4]! - 1).returning).toBe(false);
    expect(simulationStateAt(p, p.time_s[4]!).returning).toBe(true);
    expect(simulationStateAt(p, 1e9).pastPointOfNoReturn).toBe(false);
    // The route plan keeps the flag and never reports a return.
    const route = buildSimPath(r, 'route');
    expect(simulationStateAt(route, 1e9).pastPointOfNoReturn).toBe(true);
    expect(simulationStateAt(route, 1e9).returning).toBe(false);
  });
});
