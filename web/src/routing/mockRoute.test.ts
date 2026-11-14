import { describe, expect, it } from 'vitest';
import { haversine, type LonLat } from '../lib/mars-geo';
import { MOCK_STEP_M, mockRoute } from './mockRoute';

const A: LonLat = [77.45, 18.44];
const B: LonLat = [77.46, 18.44];
const C: LonLat = [77.46, 18.45];

describe('mockRoute', () => {
  it('rejects fewer than 2 points', () => {
    expect(() => mockRoute([])).toThrow();
    expect(() => mockRoute([A])).toThrow();
  });

  it('dist_m matches the sum of haversines between the points', () => {
    const r = mockRoute([A, B, C]);
    const expected = haversine(A, B) + haversine(B, C);
    expect(Math.abs(r.properties.dist_m - expected) / expected).toBeLessThan(1e-3);
  });

  it('last profile point is dist_m and there is one profile point per vertex', () => {
    const r = mockRoute([A, B, C]);
    const { profile, dist_m } = r.properties;
    expect(profile[0]![0]).toBe(0);
    expect(profile.at(-1)![0]).toBeCloseTo(dist_m, 6);
    expect(profile).toHaveLength(r.geometry.coordinates.length);
  });

  it('densifies: no segment exceeds ~50 m and the original points are on the path', () => {
    const r = mockRoute([A, B]);
    const cs = r.geometry.coordinates;
    expect(cs.length).toBeGreaterThan(2);
    for (let i = 1; i < cs.length; i++) {
      expect(haversine(cs[i - 1]!, cs[i]!)).toBeLessThanOrEqual(MOCK_STEP_M + 1e-6);
    }
    expect(cs[0]).toEqual(A);
    expect(cs.at(-1)).toEqual(B);
  });

  it('flags mock and GO verdict', () => {
    const r = mockRoute([A, B]);
    expect(r.properties.mock).toBe(true);
    expect(r.properties.verdict).toBe('GO');
  });

  it('doubling the distance doubles time and O₂', () => {
    const short = mockRoute([A, B]).properties;
    const long = mockRoute([A, B, [77.47, 18.44]]).properties;
    expect(long.dist_m / short.dist_m).toBeCloseTo(2, 2);
    expect(long.time_s / short.time_s).toBeCloseTo(2, 2);
    expect(long.o2_kg / short.o2_kg).toBeCloseTo(2, 2);
  });
});
