/**
 * Walking model and per-segment O₂ consumption.
 *
 * REFERENCE (speed): Tobler's hiking function (1993), `v = 6·exp(−3.5·|S + 0.05|)` km/h,
 * with S = signed tan(slope angle). Here it is normalized so that flat terrain equals `speedFlatMS`.
 *
 * ASSUMPTIONS (no scientific reference; calibrate and cite when a source is found):
 * - `speedFlatMS`: speed of a suited astronaut on flat terrain.
 * - `o2BaseKgPerH`: O₂ consumption while walking on flat terrain.
 * - `o2UphillGain`: how much climbing raises consumption (per unit of gradient).
 * - `minSpeedMS`: speed floor, so we never divide by nearly zero.
 * - Mars gravity (0.38 g) is not modeled.
 */

export interface WalkProfile {
  /** ASSUMPTION: speed on flat terrain (m/s). */
  speedFlatMS: number;
  /** Speed floor (m/s). */
  minSpeedMS: number;
  /** ASSUMPTION: O₂ consumption on flat terrain (kg per hour). */
  o2BaseKgPerH: number;
  /** ASSUMPTION: relative consumption increase per unit of uphill gradient (rise/run). */
  o2UphillGain: number;
}

export const DEFAULT_WALK: WalkProfile = {
  speedFlatMS: 1.0,
  minSpeedMS: 0.1,
  o2BaseKgPerH: 0.1,
  o2UphillGain: 4,
};

/** ASSUMPTION: O₂ available at departure (kg), about 10 h of walking on flat terrain. */
export const DEFAULT_O2_AVAILABLE_KG = 1.0;

/** Speed (m/s) for a signed gradient `grade` = rise/run (positive = uphill). */
export function walkingSpeed(grade: number, walk: WalkProfile = DEFAULT_WALK): number {
  const v = walk.speedFlatMS * Math.exp(-3.5 * (Math.abs(grade + 0.05) - 0.05));
  return Math.max(v, walk.minSpeedMS);
}

/** Time and O₂ to walk `distM` horizontal meters with an elevation change of `deltaElevM`. */
export function segmentCost(
  distM: number,
  deltaElevM: number,
  walk: WalkProfile = DEFAULT_WALK,
): { time_s: number; o2_kg: number } {
  if (distM <= 0) return { time_s: 0, o2_kg: 0 };
  const grade = deltaElevM / distM;
  const time_s = distM / walkingSpeed(grade, walk);
  const rateKgPerS = (walk.o2BaseKgPerH / 3600) * (1 + walk.o2UphillGain * Math.max(0, grade));
  return { time_s, o2_kg: time_s * rateKgPerS };
}
