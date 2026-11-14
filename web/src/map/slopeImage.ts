import type { Meta } from '../types/contract';
import { DEFAULT_PROFILE } from '../routing/core/cost';
import { isNoData } from '../routing/core/grid';

/** Slopes below this are left transparent: flat enough not to matter for the EVA. */
export const SLOPE_MIN_DEG = 10;

/** Slope at which the route planner treats a cell as impassable (same constant as routing). */
export const SLOPE_LIMIT_DEG = DEFAULT_PROFILE.maxSlopeDeg;

/**
 * RGBA color of one slope value (degrees). Transparent under `SLOPE_MIN_DEG` and on no-data cells;
 * yellow → orange between `SLOPE_MIN_DEG` and the limit; solid red at or above the routing limit.
 */
export function slopeColor(meta: Meta, deg: number): [number, number, number, number] {
  if (isNoData(meta, deg) || deg < SLOPE_MIN_DEG) return [0, 0, 0, 0];
  if (deg >= SLOPE_LIMIT_DEG) return [224, 32, 27, 255];
  const t = (deg - SLOPE_MIN_DEG) / (SLOPE_LIMIT_DEG - SLOPE_MIN_DEG);
  // yellow (255, 233, 77) → orange (255, 154, 31), opacity growing with steepness.
  return [255, Math.round(233 - 79 * t), Math.round(77 - 46 * t), Math.round(140 + 115 * t)];
}

/** Converts the slope grid (row 0 = north, like the image) into RGBA pixels, one per cell. */
export function slopeToRgba(meta: Meta, slope: Float32Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(slope.length * 4);
  for (let i = 0; i < slope.length; i++) out.set(slopeColor(meta, slope[i]!), i * 4);
  return out;
}
