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

/**
 * O₂ available at departure (kg): the primary O₂ of NASA's lunar (Constellation) EMU PLSS design,
 * 1.6 lbm = 0.726 kg at 3000 psia, rated for an 8-hour EVA (NASA NTRS 20160002044, "Historical PLSS
 * Comparison"). Rounded to 0.73 kg. The secondary (emergency) O₂ is not counted. About 7 h of walking
 * on flat terrain with this model.
 */
export const DEFAULT_O2_AVAILABLE_KG = 0.73;

/**
 * Safety reserve: share of the O₂ available that the plan must leave untouched (10%). The verdict and
 * the point of no return only count on the remaining 90%.
 * Basis: NASA keeps a 30-minute O₂ reserve on EVAs (Apollo "red line", Apollo 11 and 12 Lunar Surface
 * Operations Plans; EMU consumables budget). With the defaults (0.73 kg, ~0.10 kg/h walking on flat
 * ground) 30 minutes is about 0.05 kg, i.e. 7%. Team choice: 10% (0.073 kg, about 45 minutes of flat
 * walking), as a fixed share of the supply for an extra margin.
 */
export const O2_RESERVE_FRACTION = 0.1;

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

/**
 * EVA parameters the planner can tune (issue #61). O₂ consumption is not set directly: it follows
 * from the metabolic model above, so the planner changes it through the carried load (and the pace).
 * The defaults come from `DEFAULT_WALK` and `DEFAULT_O2_AVAILABLE_KG`; the ranges are ASSUMPTIONS.
 */
export interface EvaParams {
  /** Walking speed on flat terrain (m/s). */
  speedFlatMS: number;
  /** Suit + backpack + carried gear (kg), Pandolf's L. A heavier load costs more O₂ per hour. */
  loadMassKg: number;
  /** O₂ available at departure (kg). */
  o2_available_kg: number;
}

export const DEFAULT_EVA_PARAMS: EvaParams = {
  speedFlatMS: DEFAULT_WALK.speedFlatMS,
  loadMassKg: DEFAULT_WALK.loadMassKg,
  o2_available_kg: DEFAULT_O2_AVAILABLE_KG,
};

/**
 * ASSUMPTION: sane ranges for the planner inputs (inclusive). Wide enough to cover the presets,
 * narrow enough to keep the model away from degenerate values (zero speed, zero O₂ use).
 */
export const EVA_PARAM_RANGES: Record<keyof EvaParams, { min: number; max: number }> = {
  speedFlatMS: { min: 0.2, max: 2 },
  loadMassKg: { min: 40, max: 150 },
  o2_available_kg: { min: 0.1, max: 5 },
};

/** Clamps each provided field to its range; non-finite values are ignored (the field is dropped). */
export function clampEvaParams(partial: Partial<EvaParams>): Partial<EvaParams> {
  const out: Partial<EvaParams> = {};
  for (const key of Object.keys(EVA_PARAM_RANGES) as (keyof EvaParams)[]) {
    const v = partial[key];
    if (v === undefined || !Number.isFinite(v)) continue;
    const { min, max } = EVA_PARAM_RANGES[key];
    out[key] = Math.min(max, Math.max(min, v));
  }
  return out;
}
