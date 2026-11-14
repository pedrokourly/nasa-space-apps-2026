import { describe, expect, it } from 'vitest';
import { NoPathError, OutOfGridError } from './errors';
import { cellToLonLat } from './grid';
import { buildMockGrid, flatGrid, wallWithGapGrid, mockMeta } from './mockGrid';
import { createRouter, route } from './route';
import { DEFAULT_WALK, segmentCost, walkingSpeed } from './walk';

const cellPt = (g: ReturnType<typeof flatGrid>, col: number, row: number) => cellToLonLat(g.meta, col, row);

describe('walking model', () => {
  it('flat equals the base speed; climbing is slower than flat', () => {
    expect(walkingSpeed(0)).toBeCloseTo(DEFAULT_WALK.speedFlatMS, 10);
    expect(walkingSpeed(0.3)).toBeLessThan(walkingSpeed(0));
    expect(walkingSpeed(-0.05)).toBeGreaterThan(walkingSpeed(0)); // Tobler peak: a slight downhill
  });

  it('climbing uses more O₂ than walking the same stretch on flat terrain', () => {
    const flat = segmentCost(100, 0);
    const up = segmentCost(100, 20);
    expect(up.time_s).toBeGreaterThan(flat.time_s);
    expect(up.o2_kg).toBeGreaterThan(flat.o2_kg);
  });

  it('zero distance costs nothing', () => {
    expect(segmentCost(0, 5)).toEqual({ time_s: 0, o2_kg: 0 });
  });
});

describe('route(): metrics', () => {
  it('returns a Feature LineString with dist_m, time_s, o2_kg and a consistent profile', () => {
    const g = flatGrid(40, 10, 20);
    const r = route(g, [cellPt(g, 0, 5), cellPt(g, 30, 5)]);
    expect(r.type).toBe('Feature');
    expect(r.geometry.type).toBe('LineString');
    const { dist_m, time_s, o2_kg, profile } = r.properties;
    expect(dist_m).toBeGreaterThan(0);
    expect(time_s).toBeGreaterThan(0);
    expect(o2_kg).toBeGreaterThan(0);
    expect(profile).toHaveLength(r.geometry.coordinates.length);
    expect(profile[0]![0]).toBe(0);
    expect(profile[profile.length - 1]![0]).toBeCloseTo(dist_m, 6);
    for (const [lon] of r.geometry.coordinates) {
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
    }
  });

  it('flat grid: doubling the distance doubles time and O₂', () => {
    const g = flatGrid(60, 5, 20);
    const a = route(g, [cellPt(g, 0, 2), cellPt(g, 10, 2)]).properties;
    const b = route(g, [cellPt(g, 0, 2), cellPt(g, 20, 2)]).properties;
    expect(b.dist_m / a.dist_m).toBeCloseTo(2, 6);
    expect(b.time_s / a.time_s).toBeCloseTo(2, 6);
    expect(b.o2_kg / a.o2_kg).toBeCloseTo(2, 6);
  });

  it('a climb is slower and uses more O₂ than flat terrain', () => {
    const ramp = buildMockGrid(40, 5, (col) => ({ elev: -2500 + col * 0.5, slope: 1.43 }));
    const flat = flatGrid(40, 5, 20);
    const up = route(ramp, [cellPt(ramp, 0, 2), cellPt(ramp, 30, 2)]).properties;
    const level = route(flat, [cellPt(flat, 0, 2), cellPt(flat, 30, 2)]).properties;
    expect(up.time_s).toBeGreaterThan(level.time_s);
    expect(up.o2_kg).toBeGreaterThan(level.o2_kg);
  });

  it('createRouter binds the grid and the options', () => {
    const g = flatGrid(20, 5, 20);
    const fn = createRouter(g, { o2_available_kg: 123 });
    const pts = [cellPt(g, 0, 2), cellPt(g, 10, 2)];
    expect(fn(pts)).toEqual(route(g, pts, { o2_available_kg: 123 }));
  });
});

describe('route(): verdict and point of no return', () => {
  const g = flatGrid(40, 5, 20);
  const A = cellPt(g, 0, 2);
  const B = cellPt(g, 20, 2);
  const total = route(g, [A, B]).properties.o2_kg; // outbound only, 20 equal steps
  const step = total / 20;

  it('one-way route: needs the round trip; 1.5× the outbound O₂ is NO-GO', () => {
    expect(route(g, [A, B], { o2_available_kg: total * 1.5 }).properties.verdict).toBe('NO-GO');
    expect(route(g, [A, B], { o2_available_kg: total * 2.01 }).properties.verdict).toBe('GO');
  });

  it('loop back to the start: the O₂ of the whole trip is enough', () => {
    const loop = route(g, [A, B, A]).properties;
    expect(loop.o2_kg).toBeCloseTo(2 * total, 8);
    expect(route(g, [A, B, A], { o2_available_kg: loop.o2_kg * 1.01 }).properties.verdict).toBe('GO');
    expect(route(g, [A, B, A], { o2_available_kg: loop.o2_kg * 0.99 }).properties.verdict).toBe('NO-GO');
  });

  it('point of no return: first vertex where outbound + return exceeds what is available', () => {
    // On flat terrain, outbound + return at vertex i = 2·i·step; with 4.5·step available it exceeds at i = 3.
    const r = route(g, [A, B], { o2_available_kg: 4.5 * step });
    expect(r.properties.verdict).toBe('NO-GO');
    expect(r.properties.point_of_no_return).toBe(3);
  });

  it('with spare O₂ there is no point of no return', () => {
    const r = route(g, [A, B], { o2_available_kg: 100 });
    expect(r.properties.verdict).toBe('GO');
    expect(r.properties.point_of_no_return).toBeUndefined();
  });
});

describe('route(): errors', () => {
  it('fewer than 2 points', () => {
    const g = flatGrid(5, 5);
    expect(() => route(g, [cellPt(g, 0, 0)])).toThrow(/2 points/);
  });

  it('a point outside the grid throws OutOfGridError', () => {
    const g = flatGrid(5, 5);
    expect(() => route(g, [cellPt(g, 0, 0), [0, 0]])).toThrow(OutOfGridError);
  });

  it('no path throws NoPathError', () => {
    const g = buildMockGrid(9, 9, (col) => (col === 4 ? { slope: 40 } : {}));
    expect(() => route(g, [cellPt(g, 0, 4), cellPt(g, 8, 4)])).toThrow(NoPathError);
  });

  it('goes through the wall gap and returns a verdict', () => {
    const g = wallWithGapGrid(21, 21, 3);
    const r = route(g, [cellPt(g, 0, 18), cellPt(g, 20, 18)]);
    expect(r.geometry.coordinates.length).toBeGreaterThan(20);
    expect(r.properties.verdict).toBeDefined();
  });

  it('mockMeta is consistent: cell side in meters matches the bbox', () => {
    const m = mockMeta(100, 100, 20);
    const dLat = (m.bbox[3] - m.bbox[1]) / m.height;
    expect((dLat * Math.PI) / 180 * 3389500).toBeCloseTo(20, 6);
  });
});
