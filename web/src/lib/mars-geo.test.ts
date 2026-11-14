import { describe, it, expect } from 'vitest';
import {
  MARS_RADIUS_M,
  haversine,
  normalizeLon,
  toLatLng,
  toLonLat,
} from './mars-geo';

const JEZERO: [number, number] = [77.45, 18.44];

describe('haversine (Mars radius)', () => {
  it('1° of latitude ≈ 59,158 m on the sphere of Mars', () => {
    const expected = (2 * Math.PI * MARS_RADIUS_M) / 360;
    const d = haversine([0, 0], [0, 1]);
    expect(d).toBeCloseTo(expected, 3);
    // Sanity check: within ~59,157 to 59,159 m, not Earth's value (~111 km).
    expect(d).toBeGreaterThan(59157);
    expect(d).toBeLessThan(59159);
  });

  it('zero distance for the same point', () => {
    expect(haversine(JEZERO, JEZERO)).toBe(0);
  });

  it('is symmetric: haversine(a, b) == haversine(b, a)', () => {
    const a: [number, number] = [77.45, 18.44];
    const b: [number, number] = [-120.5, -30.2];
    expect(haversine(a, b)).toBeCloseTo(haversine(b, a), 6);
  });

  it('crosses the antimeridian: (179.9, 0) → (−179.9, 0) ≈ 0.2° of arc (~11.8 km)', () => {
    const d = haversine([179.9, 0], [-179.9, 0]);
    const arcDeg = d / (MARS_RADIUS_M * (Math.PI / 180));
    expect(arcDeg).toBeCloseTo(0.2, 6);
    expect(d).toBeCloseTo(11832, -1);
    expect(d).toBeLessThan(20000);
  });

  it('half the equator between (0,0) and (180,0) = π·R', () => {
    expect(haversine([0, 0], [180, 0])).toBeCloseTo(Math.PI * MARS_RADIUS_M, 3);
  });
});

describe('normalizeLon', () => {
  it('normalizes longitudes to the range [−180, 180)', () => {
    expect(normalizeLon(0)).toBeCloseTo(0, 10);
    expect(normalizeLon(360)).toBeCloseTo(0, 10);
    expect(normalizeLon(180)).toBeCloseTo(-180, 10);
    expect(normalizeLon(-180)).toBeCloseTo(-180, 10);
    expect(normalizeLon(270)).toBeCloseTo(-90, 10);
    expect(normalizeLon(540)).toBeCloseTo(-180, 10);
    expect(normalizeLon(-540)).toBeCloseTo(-180, 10);
    expect(normalizeLon(77.45)).toBeCloseTo(77.45, 10);
    expect(normalizeLon(437.45)).toBeCloseTo(77.45, 10);
  });
});

describe('toLatLng / toLonLat', () => {
  it('round trip at Jezero preserves lon and lat', () => {
    const ll = toLatLng(JEZERO);
    expect(ll).toEqual({ lat: 18.44, lng: 77.45 });
    const back = toLonLat(ll);
    expect(back[0]).toBeCloseTo(77.45, 10);
    expect(back[1]).toBeCloseTo(18.44, 10);
  });

  it('toLonLat normalizes the longitude coming from Leaflet', () => {
    const [lon, lat] = toLonLat({ lat: 10, lng: 437.45 });
    expect(lon).toBeCloseTo(77.45, 10);
    expect(lat).toBe(10);
  });
});
