// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import L from 'leaflet';
import { haversine, type LonLat } from '../lib/mars-geo';
import { MarsCRS } from './marsCrs';

describe('MarsCRS', () => {
  it('mede 1 grau de latitude com o raio de Marte (2π·3389500/360 m)', () => {
    const d = MarsCRS.distance(L.latLng(18, 77), L.latLng(19, 77));
    expect(Math.abs(d - 59157.9)).toBeLessThan(1);
  });

  it('não usa o raio da Terra', () => {
    const terra = L.CRS.EPSG4326.distance(L.latLng(18, 77), L.latLng(19, 77));
    const marte = MarsCRS.distance(L.latLng(18, 77), L.latLng(19, 77));
    expect(marte).toBeLessThan(terra / 1.5);
  });

  it('concorda com o haversine de mars-geo', () => {
    const pares: [LonLat, LonLat][] = [
      [[77, 18], [77, 19]],
      [[77.4508, 18.4447], [77.2, 18.6]],
      [[-120, -30], [60, 45]],
      [[179.5, 10], [-179.5, 10]],
    ];
    for (const [a, b] of pares) {
      const leaflet = MarsCRS.distance(L.latLng(a[1], a[0]), L.latLng(b[1], b[0]));
      expect(Math.abs(leaflet - haversine(a, b))).toBeLessThan(1);
    }
  });
});
