/**
 * Exact wording for the route numbers, from decision 0002 (`docs/decisions/0002-data-nature-and-labels.md`).
 * Time, O₂, GO / NO-GO and the point of no return are ESTIMATES from our model; the route distance and
 * the elevation profile are COMPUTED from NASA terrain data. Keep the texts here so every panel says the same.
 */

/** Label for time, O₂, the verdict and the point of no return (decision 0002, "Estimated"). */
export const ESTIMATE_LABEL = 'Estimate · model with team assumptions';

/** Label for distance, slope and the elevation profile (decision 0002, "Computed from data"). */
export const COMPUTED_LABEL = 'Computed from the MRO/HiRISE terrain model';

/** Explanation of the point of no return (decision 0002, item 3). */
export const PNR_EXPLANATION =
  "First point where the O₂ left is not enough to walk back the cheapest way, under the model's assumptions.";

import { DEFAULT_O2_AVAILABLE_KG, O2_RESERVE_FRACTION } from './core/walk';

/** Where the assumptions and their sources are written. */
export const ASSUMPTIONS_URL =
  'https://github.com/pedrokourly/nasa-space-apps-2026/blob/main/docs/routing-assumptions.md';

/** Where the default O₂ comes from (`DEFAULT_O2_AVAILABLE_KG`). */
export const O2_SOURCE = 'the NASA lunar suit PLSS';

/**
 * One-line summary of the key assumptions (decision 0002, item 3), with the O₂ the planner set. The
 * source is named only while the O₂ is the sourced default.
 */
export function assumptionsLine(o2AvailableKg: number, reserveFraction = O2_RESERVE_FRACTION): string {
  const pct = Math.round(reserveFraction * 100);
  const source = o2AvailableKg === DEFAULT_O2_AVAILABLE_KG ? ` from ${O2_SOURCE}` : '';
  return `O₂ available ${o2AvailableKg.toFixed(2)} kg${source}, ${pct}% kept as reserve; metabolic model scaled to Mars gravity`;
}
