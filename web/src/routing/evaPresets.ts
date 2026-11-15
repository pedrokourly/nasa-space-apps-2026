import { DEFAULT_EVA_PARAMS, DEFAULT_O2_AVAILABLE_KG, type EvaParams } from './core/walk';

/**
 * ASSUMPTION / MOCK: EVA presets for the planner UI. The paces and loads are invented for the demo;
 * the O₂ they cost comes from the metabolic model in `core/walk.ts`.
 */
export interface EvaPreset {
  id: 'nominal' | 'conservative' | 'heavy-load';
  label: string;
  params: EvaParams;
}

export const EVA_PRESETS: readonly EvaPreset[] = [
  { id: 'nominal', label: 'Nominal', params: { ...DEFAULT_EVA_PARAMS } },
  // ASSUMPTION: slower pace, lower exertion, same O₂ supply.
  { id: 'conservative', label: 'Conservative', params: { speedFlatMS: 0.7, loadMassKg: 90, o2_available_kg: DEFAULT_O2_AVAILABLE_KG } },
  // ASSUMPTION: carrying sample cases and tools (+30 kg): slower, and the extra load raises the O₂ rate.
  { id: 'heavy-load', label: 'Heavy load', params: { speedFlatMS: 0.8, loadMassKg: 120, o2_available_kg: DEFAULT_O2_AVAILABLE_KG } },
];
