import { describe, expect, it } from 'vitest';
import { EVA_PRESETS } from '../evaPresets';
import { cellToLonLat } from './grid';
import { flatGrid } from './mockGrid';
import { createRouter, route } from './route';
import {
  clampEvaParams,
  DEFAULT_EVA_PARAMS,
  DEFAULT_O2_AVAILABLE_KG,
  DEFAULT_WALK,
  EVA_PARAM_RANGES,
  type EvaParams,
} from './walk';

const g = flatGrid(60, 5, 20);
const A = cellToLonLat(g.meta, 0, 2);
const B = cellToLonLat(g.meta, 40, 2);

describe('EVA parameters: defaults and clamping', () => {
  it('defaults come from the walking model', () => {
    expect(DEFAULT_EVA_PARAMS).toEqual({
      speedFlatMS: DEFAULT_WALK.speedFlatMS,
      o2BaseKgPerH: DEFAULT_WALK.o2BaseKgPerH,
      o2_available_kg: DEFAULT_O2_AVAILABLE_KG,
    });
  });

  it('clamps to the ranges and ignores non-finite values', () => {
    expect(clampEvaParams({ speedFlatMS: 99, o2BaseKgPerH: -1, o2_available_kg: 0 })).toEqual({
      speedFlatMS: EVA_PARAM_RANGES.speedFlatMS.max,
      o2BaseKgPerH: EVA_PARAM_RANGES.o2BaseKgPerH.min,
      o2_available_kg: EVA_PARAM_RANGES.o2_available_kg.min,
    });
    expect(clampEvaParams({ speedFlatMS: NaN, o2BaseKgPerH: Infinity })).toEqual({});
  });

  it('every preset is inside the ranges', () => {
    for (const p of EVA_PRESETS) expect(clampEvaParams(p.params)).toEqual(p.params);
  });
});

describe('EVA parameters through the router', () => {
  const router = createRouter(g);

  it('no params equals the defaults', () => {
    expect(router([A, B])).toEqual(route(g, [A, B]));
    expect(router([A, B], DEFAULT_EVA_PARAMS)).toEqual(route(g, [A, B]));
  });

  it('doubling o2BaseKgPerH on a flat grid doubles o2_kg and keeps the time', () => {
    const base = router([A, B], DEFAULT_EVA_PARAMS).properties;
    const dbl = router([A, B], { ...DEFAULT_EVA_PARAMS, o2BaseKgPerH: DEFAULT_EVA_PARAMS.o2BaseKgPerH * 2 }).properties;
    expect(dbl.o2_kg / base.o2_kg).toBeCloseTo(2, 9);
    expect(dbl.time_s).toBeCloseTo(base.time_s, 9);
  });

  it('doubling speedFlatMS halves the time', () => {
    const base = router([A, B], DEFAULT_EVA_PARAMS).properties;
    const fast = router([A, B], { ...DEFAULT_EVA_PARAMS, speedFlatMS: DEFAULT_EVA_PARAMS.speedFlatMS * 2 }).properties;
    expect(fast.time_s / base.time_s).toBeCloseTo(0.5, 9);
  });

  it('lowering o2_available_kg below the need flips GO to NO-GO with a point of no return', () => {
    const go = router([A, B, A], DEFAULT_EVA_PARAMS).properties;
    expect(go.verdict).toBe('GO');
    expect(go.point_of_no_return).toBeUndefined();

    const params: EvaParams = { ...DEFAULT_EVA_PARAMS, o2_available_kg: go.o2_kg * 0.9 };
    const noGo = router([A, B, A], params).properties;
    expect(noGo.verdict).toBe('NO-GO');
    expect(noGo.point_of_no_return).toBeGreaterThan(0);
  });
});
