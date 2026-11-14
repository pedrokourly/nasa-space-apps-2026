import { normalizeLon } from '../lib/mars-geo';

const coordFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

/** Formats lat/lon as "18.4447° N · 77.4508° E", with longitude in −180 to 180. */
export function formatLatLon(lat: number, lng: number): string {
  const lon = normalizeLon(lng);
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${coordFormat.format(Math.abs(lat))}° ${ns} · ${coordFormat.format(Math.abs(lon))}° ${ew}`;
}
