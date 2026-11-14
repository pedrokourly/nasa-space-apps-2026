import { describe, expect, it } from 'vitest';
import type { Route } from '../types/contract';
import { profilePointAt } from './profilePoint';

const route: Route = {
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: [
      [77.4, 18.44],
      [77.41, 18.45],
      [77.42, 18.46],
    ],
  },
  properties: {
    dist_m: 1200,
    tempo_s: 1200,
    o2_kg: 0.03,
    perfil: [
      [0, -2500],
      [600, -2480],
      [1200, -2490],
    ],
    ponto_nao_retorno: 1,
  },
};

describe('profilePointAt', () => {
  it('devolve vértice, distância e elevação do índice do perfil', () => {
    expect(profilePointAt(route, 1)).toEqual({ lonlat: [77.41, 18.45], dist_m: 600, elev_m: -2480 });
    expect(profilePointAt(route, 2)?.dist_m).toBe(1200);
  });

  it('devolve null para índice ausente ou fora da rota', () => {
    expect(profilePointAt(route, null)).toBeNull();
    expect(profilePointAt(route, undefined)).toBeNull();
    expect(profilePointAt(route, -1)).toBeNull();
    expect(profilePointAt(route, 3)).toBeNull();
    expect(profilePointAt(route, 0.5)).toBeNull();
    expect(profilePointAt(null, 0)).toBeNull();
  });

  it('devolve null se o perfil for mais curto que a geometria', () => {
    const curto: Route = { ...route, properties: { ...route.properties, perfil: [[0, -2500]] } };
    expect(profilePointAt(curto, 1)).toBeNull();
  });
});
