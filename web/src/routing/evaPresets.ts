import { DEFAULT_EVA_PARAMS, type EvaParams } from './core/walk';

/**
 * ASSUMPTION / MOCK: EVA presets for the planner UI. The numbers are invented for the demo; there is
 * no scientific reference yet (suit, load and metabolic data still to be sourced and cited).
 */
export interface EvaPreset {
  id: 'nominal' | 'conservative' | 'heavy-load';
  label: string;
  params: EvaParams;
}

export const EVA_PRESETS: readonly EvaPreset[] = [
  { id: 'nominal', label: 'Nominal', params: { ...DEFAULT_EVA_PARAMS } },
  // ASSUMPTION: slower pace, lower exertion, same O₂ supply.
  { id: 'conservative', label: 'Conservative', params: { speedFlatMS: 0.7, o2BaseKgPerH: 0.08, o2_available_kg: 1.0 } },
  // ASSUMPTION: carrying sample cases and tools: slower and a higher O₂ rate.
  { id: 'heavy-load', label: 'Heavy load', params: { speedFlatMS: 0.8, o2BaseKgPerH: 0.15, o2_available_kg: 1.0 } },
];
