/**
 * Utilitários geodésicos para Marte. Lógica pura, sem dependências externas
 * e sem Leaflet, para ser reutilizada no mapa 2D, no roteamento (Web Worker) e na UI.
 *
 * Atenção às armadilhas de Marte: nunca use o raio da Terra. O `map.distance()`
 * do Leaflet padrão usa o raio terrestre; use sempre `haversine` deste módulo.
 */

/** Raio médio de Marte em metros (3389,5 km). */
export const MARS_RADIUS_M = 3389500;

/**
 * Coordenada na ordem GeoJSON: `[lon, lat]`, com longitude em −180 a 180 graus.
 * Atenção: GeoJSON usa [lon, lat], enquanto o Leaflet usa {lat, lng}.
 */
export type LonLat = [lon: number, lat: number];

/**
 * Coordenada no formato do Leaflet: `{ lat, lng }`. É compatível
 * estruturalmente com `L.LatLng`, sem importar Leaflet aqui.
 */
export interface LatLngLike {
  lat: number;
  lng: number;
}

const DEG_TO_RAD = Math.PI / 180;

/**
 * Distância ortodrômica (grande círculo) em metros entre dois pontos na esfera de Marte.
 * Usa a fórmula de haversine com R = {@link MARS_RADIUS_M}. Funciona atravessando
 * o antimeridiano, porque o seno da diferença de longitude já trata o wrap.
 *
 * @param a ponto de origem em `[lon, lat]` (graus)
 * @param b ponto de destino em `[lon, lat]` (graus)
 * @returns distância em metros
 */
export function haversine(a: LonLat, b: LonLat): number {
  const [lonA, latA] = a;
  const [lonB, latB] = b;
  const phi1 = latA * DEG_TO_RAD;
  const phi2 = latB * DEG_TO_RAD;
  const dPhi = (latB - latA) * DEG_TO_RAD;
  const dLambda = (lonB - lonA) * DEG_TO_RAD;

  const sinHalfDPhi = Math.sin(dPhi / 2);
  const sinHalfDLambda = Math.sin(dLambda / 2);
  const h = sinHalfDPhi * sinHalfDPhi + Math.cos(phi1) * Math.cos(phi2) * sinHalfDLambda * sinHalfDLambda;
  // Protege contra erros de ponto flutuante que levem h para fora de [0, 1].
  const clamped = Math.min(1, Math.max(0, h));
  const c = 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));

  return MARS_RADIUS_M * c;
}

/**
 * Normaliza uma longitude qualquer (0–360, negativa ou maior que 360) para o
 * intervalo [−180, 180). Exemplo: 270 vira −90 e 437.45 vira 77.45.
 *
 * @param lon longitude em graus
 * @returns longitude em graus no intervalo [−180, 180)
 */
export function normalizeLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/**
 * Converte `[lon, lat]` (GeoJSON) para `{ lat, lng }` (Leaflet).
 *
 * @param coord coordenada em ordem GeoJSON
 * @returns coordenada no formato do Leaflet
 */
export function toLatLng([lon, lat]: LonLat): LatLngLike {
  return { lat, lng: lon };
}

/**
 * Converte `{ lat, lng }` (Leaflet) para `[lon, lat]` (GeoJSON), aplicando
 * {@link normalizeLon} para garantir longitude em −180 a 180.
 *
 * @param ll coordenada no formato do Leaflet
 * @returns coordenada em ordem GeoJSON, com longitude normalizada
 */
export function toLonLat(ll: LatLngLike): LonLat {
  return [normalizeLon(ll.lng), ll.lat];
}
