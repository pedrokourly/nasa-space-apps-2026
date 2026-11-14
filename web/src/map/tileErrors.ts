/** Pure counting logic for tile load failures (no Leaflet, no React). */

export const ERROR_THRESHOLD = 3
export const ERROR_WINDOW_MS = 10_000

/** Returns the timestamps still inside the window ending at `now`. */
export function pruneErrors(times: readonly number[], now: number, windowMs = ERROR_WINDOW_MS): number[] {
  return times.filter((t) => now - t <= windowMs)
}

/** Records an error at `now` and returns the pruned list including it. */
export function recordError(times: readonly number[], now: number, windowMs = ERROR_WINDOW_MS): number[] {
  return [...pruneErrors(times, now, windowMs), now]
}

/** True when the layer has accumulated enough recent errors to warn the user. */
export function isUnhealthy(
  times: readonly number[],
  now: number,
  threshold = ERROR_THRESHOLD,
  windowMs = ERROR_WINDOW_MS,
): boolean {
  return pruneErrors(times, now, windowMs).length >= threshold
}

export interface LatLngBoundsLike {
  contains(p: { lat: number; lng: number }): boolean
}

/** Errors for tiles whose centre lies outside the layer bounds are expected and ignored. */
export function isTileInBounds(bounds: LatLngBoundsLike | undefined, centre: { lat: number; lng: number }): boolean {
  return !bounds || bounds.contains(centre)
}
