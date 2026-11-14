import { haversine, type LonLat } from '../lib/mars-geo';
import type { Route } from '../types/contract';

/*
 * MOCK: os valores abaixo são SUPOSIÇÕES para a demo, não valores científicos.
 * A frente Roteamento (#37/#38) os substitui pelo modelo real de caminhada e O₂.
 */
/** SUPOSIÇÃO/MOCK: velocidade de caminhada constante (m/s). */
export const MOCK_SPEED_M_S = 1;
/** SUPOSIÇÃO/MOCK: consumo de O₂ (kg por hora). */
export const MOCK_O2_KG_PER_H = 0.1;
/** Espaçamento máximo entre vértices do traçado (m), para o perfil e o hover terem resolução. */
export const MOCK_STEP_M = 50;
/** MOCK: elevação sintética determinística (m): base + amplitude * sen(2π · dist / comprimento de onda). */
const MOCK_ELEV_BASE_M = -2500;
const MOCK_ELEV_AMPLITUDE_M = 30;
const MOCK_ELEV_WAVELENGTH_M = 600;

function mockElevation(distM: number): number {
  return MOCK_ELEV_BASE_M + MOCK_ELEV_AMPLITUDE_M * Math.sin((2 * Math.PI * distM) / MOCK_ELEV_WAVELENGTH_M);
}

/** Liga os pontos em linha reta, densificando a cada ~50 m. Lógica pura. */
export function mockRoute(points: LonLat[]): Route {
  if (points.length < 2) throw new Error('mockRoute precisa de pelo menos 2 pontos');

  const verts: LonLat[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const n = Math.max(1, Math.ceil(haversine(a, b) / MOCK_STEP_M));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      verts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }

  const perfil: [number, number][] = [[0, mockElevation(0)]];
  let dist = 0;
  for (let i = 1; i < verts.length; i++) {
    dist += haversine(verts[i - 1]!, verts[i]!);
    perfil.push([dist, mockElevation(dist)]);
  }

  const tempo_s = dist / MOCK_SPEED_M_S;
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: verts },
    properties: {
      dist_m: dist,
      tempo_s,
      o2_kg: (tempo_s / 3600) * MOCK_O2_KG_PER_H,
      perfil,
      veredito: 'GO',
      mock: true,
    },
  };
}
