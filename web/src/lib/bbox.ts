import { haversine, type LonLat } from './mars-geo';

/** `[minLon, minLat, maxLon, maxLat]` in degrees, longitude −180 to 180 (same format as `meta.bbox`). */
export type Bbox = [minLon: number, minLat: number, maxLon: number, maxLat: number];

/** Tells whether the `[lon, lat]` point is inside the bbox. Edges are inclusive. */
export function isInsideBbox(p: LonLat, bbox: Bbox): boolean {
  const [lon, lat] = p;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

/**
 * Size of the bbox on the surface of Mars, in meters. Width is measured along the bbox's
 * mid-latitude parallel, height along a meridian (both with the Mars radius).
 */
export function bboxSizeM(bbox: Bbox): { widthM: number; heightM: number } {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const midLat = (minLat + maxLat) / 2;
  return {
    widthM: haversine([minLon, midLat], [maxLon, midLat]),
    heightM: haversine([minLon, minLat], [minLon, maxLat]),
  };
}
