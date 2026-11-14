import type { LonLat } from './mars-geo';

const PREFIX = '#route=';

/** Serializes waypoints as `#route=lon,lat;lon,lat` (5 decimals). Empty input gives an empty string. */
export function encodeRouteHash(points: readonly LonLat[]): string {
  if (points.length === 0) return '';
  return PREFIX + points.map(([lon, lat]) => `${lon.toFixed(5)},${lat.toFixed(5)}`).join(';');
}

/** Parses a `#route=` hash. Returns null for anything invalid; never throws. */
export function parseRouteHash(hash: string): LonLat[] | null {
  if (typeof hash !== 'string' || !hash.startsWith(PREFIX)) return null;
  const body = hash.slice(PREFIX.length);
  if (body === '') return null;
  const out: LonLat[] = [];
  for (const part of body.split(';')) {
    const pair = part.split(',');
    if (pair.length !== 2) return null;
    const [a, b] = pair;
    if (a.trim() === '' || b.trim() === '') return null;
    const lon = Number(a);
    const lat = Number(b);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
    out.push([lon, lat]);
  }
  return out;
}
