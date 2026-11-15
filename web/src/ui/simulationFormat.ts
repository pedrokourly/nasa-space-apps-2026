/** Elapsed EVA time as `h:mm` (minutes truncated, so it never runs ahead of the clock). */
export function formatElapsed(seconds: number): string {
  const totalMin = Math.max(0, Math.round(seconds / 60)); // same rounding as RouteSummary
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Distance in meters below 1 km, kilometers (two decimals) above. */
export function formatDistance(meters: number): string {
  const m = Math.max(0, meters);
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
}
