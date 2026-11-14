import type { LonLat } from './mars-geo';

/** `[minLon, minLat, maxLon, maxLat]` em graus, longitude −180 a 180 (mesmo formato de `meta.bbox`). */
export type Bbox = [minLon: number, minLat: number, maxLon: number, maxLat: number];

/** Diz se o ponto `[lon, lat]` está dentro do bbox. As bordas são inclusivas. */
export function isInsideBbox(p: LonLat, bbox: Bbox): boolean {
  const [lon, lat] = p;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}
