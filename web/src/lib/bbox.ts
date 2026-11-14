import type { LonLat } from './mars-geo';

/** `[minLon, minLat, maxLon, maxLat]` in degrees, longitude −180 to 180 (same format as `meta.bbox`). */
export type Bbox = [minLon: number, minLat: number, maxLon: number, maxLat: number];

/** Tells whether the `[lon, lat]` point is inside the bbox. Edges are inclusive. */
export function isInsideBbox(p: LonLat, bbox: Bbox): boolean {
  const [lon, lat] = p;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}
