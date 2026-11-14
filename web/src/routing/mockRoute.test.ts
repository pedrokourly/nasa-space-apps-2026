import { describe, expect, it } from 'vitest';
import { haversine, type LonLat } from '../lib/mars-geo';
import { MOCK_STEP_M, mockRoute } from './mockRoute';

const A: LonLat = [77.45, 18.44];
const B: LonLat = [77.46, 18.44];
const C: LonLat = [77.46, 18.45];

describe('mockRoute', () => {
  it('rejeita menos de 2 pontos', () => {
    expect(() => mockRoute([])).toThrow();
    expect(() => mockRoute([A])).toThrow();
  });

  it('dist_m bate com a soma dos haversines entre os pontos', () => {
    const r = mockRoute([A, B, C]);
    const esperado = haversine(A, B) + haversine(B, C);
    expect(Math.abs(r.properties.dist_m - esperado) / esperado).toBeLessThan(1e-3);
  });

  it('último ponto do perfil é dist_m e há um ponto de perfil por vértice', () => {
    const r = mockRoute([A, B, C]);
    const { perfil, dist_m } = r.properties;
    expect(perfil[0]![0]).toBe(0);
    expect(perfil.at(-1)![0]).toBeCloseTo(dist_m, 6);
    expect(perfil).toHaveLength(r.geometry.coordinates.length);
  });

  it('densifica: nenhum trecho passa de ~50 m e os pontos originais estão no traçado', () => {
    const r = mockRoute([A, B]);
    const cs = r.geometry.coordinates;
    expect(cs.length).toBeGreaterThan(2);
    for (let i = 1; i < cs.length; i++) {
      expect(haversine(cs[i - 1]!, cs[i]!)).toBeLessThanOrEqual(MOCK_STEP_M + 1e-6);
    }
    expect(cs[0]).toEqual(A);
    expect(cs.at(-1)).toEqual(B);
  });

  it('marca mock e veredito GO', () => {
    const r = mockRoute([A, B]);
    expect(r.properties.mock).toBe(true);
    expect(r.properties.veredito).toBe('GO');
  });

  it('dobrar a distância dobra tempo e O₂', () => {
    const curta = mockRoute([A, B]).properties;
    const longa = mockRoute([A, B, [77.47, 18.44]]).properties;
    expect(longa.dist_m / curta.dist_m).toBeCloseTo(2, 2);
    expect(longa.tempo_s / curta.tempo_s).toBeCloseTo(2, 2);
    expect(longa.o2_kg / curta.o2_kg).toBeCloseTo(2, 2);
  });
});
