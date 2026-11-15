import { describe, expect, it } from 'vitest';
import { assumptionsLine, COMPUTED_LABEL, ESTIMATE_LABEL, PNR_EXPLANATION } from './estimateText';

describe('decision 0002 wording', () => {
  it('uses the exact labels of the decision', () => {
    expect(ESTIMATE_LABEL).toBe('Estimate · model with team assumptions');
    expect(COMPUTED_LABEL).toBe('Computed from the MRO/HiRISE terrain model');
    expect(PNR_EXPLANATION).toBe(
      "First point where the O₂ left is not enough to walk back the cheapest way, under the model's assumptions.",
    );
  });

  it('states the O₂ the planner set', () => {
    expect(assumptionsLine(0.73)).toBe(
      'O₂ available 0.73 kg from the NASA lunar suit PLSS, 10% kept as reserve; metabolic model scaled to Mars gravity',
    );
    expect(assumptionsLine(1)).toBe('O₂ available 1.00 kg, 10% kept as reserve; metabolic model scaled to Mars gravity');
  });
});
