/**
 * Geodesy utilities for Mars. Pure logic, no external dependencies
 * and no Leaflet, so it can be reused in the 2D map, in routing (Web Worker) and in the UI.
 *
 * Beware of the Mars pitfalls: never use Earth's radius. Stock Leaflet's `map.distance()`
 * uses the terrestrial radius; always use `haversine` from this module.
 */

/** Mean radius of Mars in meters (3389.5 km). */
export const MARS_RADIUS_M = 3389500;

/**
 * Coordinate in GeoJSON order: `[lon, lat]`, with longitude in −180 to 180 degrees.
 * Note: GeoJSON uses [lon, lat], while Leaflet uses {lat, lng}.
 */
export type LonLat = [lon: number, lat: number];

/**
 * Coordinate in Leaflet's format: `{ lat, lng }`. It is structurally
 * compatible with `L.LatLng`, without importing Leaflet here.
 */
export interface LatLngLike {
  lat: number;
  lng: number;
}

const DEG_TO_RAD = Math.PI / 180;

/**
 * Great-circle distance in meters between two points on the sphere of Mars.
 * Uses the haversine formula with R = {@link MARS_RADIUS_M}. Works across
 * the antimeridian, because the sine of the longitude difference already handles the wrap.
 *
 * @param a origin point as `[lon, lat]` (degrees)
 * @param b destination point as `[lon, lat]` (degrees)
 * @returns distance in meters
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
  // Guards against floating-point errors that push h outside [0, 1].
  const clamped = Math.min(1, Math.max(0, h));
  const c = 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));

  return MARS_RADIUS_M * c;
}

/**
 * Normalizes any longitude (0–360, negative or greater than 360) to the
 * range [−180, 180). Example: 270 becomes −90 and 437.45 becomes 77.45.
 *
 * @param lon longitude in degrees
 * @returns longitude in degrees in the range [−180, 180)
 */
export function normalizeLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/**
 * Converts `[lon, lat]` (GeoJSON) to `{ lat, lng }` (Leaflet).
 *
 * @param coord coordinate in GeoJSON order
 * @returns coordinate in Leaflet's format
 */
export function toLatLng([lon, lat]: LonLat): LatLngLike {
  return { lat, lng: lon };
}

/**
 * Converts `{ lat, lng }` (Leaflet) to `[lon, lat]` (GeoJSON), applying
 * {@link normalizeLon} to guarantee longitude in −180 to 180.
 *
 * @param ll coordinate in Leaflet's format
 * @returns coordinate in GeoJSON order, with normalized longitude
 */
export function toLonLat(ll: LatLngLike): LonLat {
  return [normalizeLon(ll.lng), ll.lat];
}
