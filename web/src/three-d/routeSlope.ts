import { haversine, type LonLat } from '../lib/mars-geo'

/**
 * Pure helpers for the 3D route: slope per segment, color classes and vertical exaggeration.
 * No Cesium, no React, so it is unit-tested on its own. Distances use the Mars radius (R = 3389.5 km).
 */

export type SlopeClass = 'easy' | 'moderate' | 'steep'

/*
 * ASSUMPTION (visualization only, not a safety limit): below 10° is "easy", 10° to 20° is "moderate",
 * above 20° is "steep". They only color the route in 3D; the routing cost function lives in `src/routing/`.
 */
export const SLOPE_MODERATE_DEG = 10
export const SLOPE_STEEP_DEG = 20

export const SLOPE_COLORS: Record<SlopeClass, string> = {
  easy: '#3ddc84',
  moderate: '#ffb020',
  steep: '#ff4d4d',
}

/** Slope in degrees (0 to 90) for a horizontal run and a height difference, both in meters. */
export function slopeDeg(horizontalM: number, dHeightM: number): number {
  if (horizontalM <= 0) return Math.abs(dHeightM) > 0 ? 90 : 0
  return (Math.atan2(Math.abs(dHeightM), horizontalM) * 180) / Math.PI
}

/**
 * Slope in degrees of each segment of a path, from the surface height at each vertex.
 * Returns `coords.length - 1` values. Throws if the lengths do not match.
 */
export function segmentSlopesDeg(coords: readonly LonLat[], heights: readonly number[]): number[] {
  if (coords.length !== heights.length)
    throw new Error('coords and heights must have the same length')
  const out: number[] = []
  for (let i = 1; i < coords.length; i++) {
    out.push(slopeDeg(haversine(coords[i - 1]!, coords[i]!), heights[i]! - heights[i - 1]!))
  }
  return out
}

/** green < 10°, amber 10° to 20° (inclusive), red > 20°. */
export function classifySlope(deg: number): SlopeClass {
  if (deg < SLOPE_MODERATE_DEG) return 'easy'
  if (deg <= SLOPE_STEEP_DEG) return 'moderate'
  return 'steep'
}

/** A run of consecutive segments with the same class, as an inclusive range of vertex indices. */
export interface SlopeRun {
  cls: SlopeClass
  /** First vertex of the run. */
  from: number
  /** Last vertex of the run (the end of its last segment). */
  to: number
}

/** Merges consecutive segments of the same class into runs; run `k` ends at the vertex where run `k + 1` starts. */
export function groupSlopeRuns(classes: readonly SlopeClass[]): SlopeRun[] {
  const runs: SlopeRun[] = []
  classes.forEach((cls, i) => {
    const last = runs[runs.length - 1]
    if (last && last.cls === cls) last.to = i + 1
    else runs.push({ cls, from: i, to: i + 1 })
  })
  return runs
}

/**
 * Fills the gaps (`undefined`, `NaN`) of a height list with the nearest known neighbor
 * (previous first, then next). Returns `null` when no height is known at all.
 */
export function fillMissingHeights(heights: readonly (number | undefined)[]): number[] | null {
  const known = (h: number | undefined): h is number => h !== undefined && Number.isFinite(h)
  if (!heights.some(known)) return null
  const out: number[] = []
  let prev: number | undefined
  heights.forEach((h) => {
    if (known(h)) prev = h
    out.push(prev ?? Number.NaN)
  })
  // Leading gap: copy the first known value backwards.
  const firstKnown = out.find((h) => !Number.isNaN(h))!
  return out.map((h) => (Number.isNaN(h) ? firstKnown : h))
}
