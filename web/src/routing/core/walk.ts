/**
 * Walking model: speed, metabolic power and O₂ per segment.
 *
 * Chain: gradient → speed (Tobler) → metabolic power (Pandolf, scaled to Mars gravity)
 *        → energy → O₂ (energy equivalent of oxygen).
 *
 * REFERENCES
 * - Speed: Tobler, W. (1993), "Three presentations on geographical analysis and modeling",
 *   NCGIA Technical Report 93-1. `v = 6·exp(−3.5·|S + 0.05|)` km/h, S = signed rise/run.
 *   Normalized here so that flat terrain gives `speedFlatMS`.
 * - Metabolic power: Pandolf, K. B., Givoni, B. & Goldman, R. F. (1977), "Predicting energy
 *   expenditure with loads while standing or walking very slowly", J. Appl. Physiol. 43(4):577–581.
 *   M [W] = 1.5·W + 2.0·(W + L)·(L / W)² + η·(W + L)·(1.5·V² + 0.35·V·G),
 *   W = body mass (kg), L = carried load (kg), V = speed (m/s), G = grade (%), η = terrain factor.
 * - O₂: about 4.8 kcal (≈ 20.1 kJ) of energy per liter of O₂ for a mixed diet (indirect
 *   calorimetry, Weir 1949); O₂ density 1.429 g/L at 0 °C and 1 atm.
 * - Sanity check: Apollo lunar EVAs measured 822 to 1267 kJ/h (≈ 230 to 350 W) per crew member
 *   (Waligora et al. 1975, NASA TN D-7883). This model gives ~395 W walking on flat terrain at
 *   1 m/s, about 0.10 kg O₂/h: above the Apollo range, so on the conservative side.
 *
 * ASSUMPTIONS (ours; change them here and in docs/routing-assumptions.md)
 * - `speedFlatMS` 1.0 m/s: suited walking pace on flat ground (Tobler gives 1.4 m/s unsuited).
 * - `bodyMassKg` 75 kg and `loadMassKg` 90 kg: astronaut, and suit + life-support backpack
 *   (order of the Apollo A7L suit with PLSS, not verified). Pandolf was fitted with lighter loads,
 *   so a load heavier than the body is an extrapolation.
 * - `terrainFactor` 1.1 (Pandolf's "dirt road") for packed regolith.
 * - Gravity: the load and walking terms are multiplied by g_Mars / g_Earth; the standing term
 *   (1.5·W) is not, since it is mostly the body's own upkeep. First-order scaling, not a
 *   measured Mars law; suit joint stiffness does not shrink with gravity, so real costs may be higher.
 * - Downhill: the grade term is not allowed to go negative (Pandolf has no downhill data), so a
 *   descent costs at least as much as flat walking at the same speed.
 */

/** Mars surface gravity (m/s²). */
export const G_MARS = 3.721;
/** Standard Earth gravity (m/s²). */
export const G_EARTH = 9.80665;
/** Energy released per liter of O₂ consumed, mixed diet (J/L). */
export const J_PER_L_O2 = 20_100;
/** O₂ density at 0 °C and 1 atm (kg/L). */
export const O2_KG_PER_L = 0.001429;

export interface WalkProfile {
  /** ASSUMPTION: speed on flat terrain (m/s). */
  speedFlatMS: number;
  /** Speed floor (m/s), so we never divide by nearly zero. */
  minSpeedMS: number;
  /** ASSUMPTION: astronaut body mass (kg), Pandolf's W. */
  bodyMassKg: number;
  /** ASSUMPTION: suit + backpack mass (kg), Pandolf's L. */
  loadMassKg: number;
  /** ASSUMPTION: Pandolf terrain factor η (1.0 paved, 1.1 dirt road, 2.1 loose sand). */
  terrainFactor: number;
  /** g_planet / g_Earth applied to the load and walking terms (Mars ≈ 0.379). */
  gravityRatio: number;
}

export const DEFAULT_WALK: WalkProfile = {
  speedFlatMS: 1.0,
  minSpeedMS: 0.1,
  bodyMassKg: 75,
  loadMassKg: 90,
  terrainFactor: 1.1,
  gravityRatio: G_MARS / G_EARTH,
};

/** ASSUMPTION: O₂ available at departure (kg), about 10 h of walking on flat terrain with this model. */
export const DEFAULT_O2_AVAILABLE_KG = 1.0;

/** Speed (m/s) for a signed gradient `grade` = rise/run (positive = uphill). Tobler, normalized. */
export function walkingSpeed(grade: number, walk: WalkProfile = DEFAULT_WALK): number {
  const v = walk.speedFlatMS * Math.exp(-3.5 * (Math.abs(grade + 0.05) - 0.05));
  return Math.max(v, walk.minSpeedMS);
}

/** Metabolic power (W) walking at `speedMS` on gradient `grade` (rise/run). Pandolf, scaled to gravity. */
export function metabolicPowerW(speedMS: number, grade: number, walk: WalkProfile = DEFAULT_WALK): number {
  const W = walk.bodyMassKg;
  const L = walk.loadMassKg;
  const gradePct = Math.max(0, grade) * 100;
  const standing = 1.5 * W;
  const load = 2.0 * (W + L) * (L / W) ** 2;
  const moving = walk.terrainFactor * (W + L) * (1.5 * speedMS * speedMS + 0.35 * speedMS * gradePct);
  return standing + walk.gravityRatio * (load + moving);
}

/** O₂ (kg) consumed by spending `energyJ` joules of metabolic energy. */
export function o2KgForEnergy(energyJ: number): number {
  return (energyJ / J_PER_L_O2) * O2_KG_PER_L;
}

/** Time and O₂ to walk `distM` horizontal meters with an elevation change of `deltaElevM`. */
export function segmentCost(
  distM: number,
  deltaElevM: number,
  walk: WalkProfile = DEFAULT_WALK,
): { time_s: number; o2_kg: number } {
  if (distM <= 0) return { time_s: 0, o2_kg: 0 };
  const grade = deltaElevM / distM;
  const speed = walkingSpeed(grade, walk);
  const time_s = distM / speed;
  return { time_s, o2_kg: o2KgForEnergy(metabolicPowerW(speed, grade, walk) * time_s) };
}
