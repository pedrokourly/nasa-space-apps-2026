import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_EVA_PARAMS, EVA_PARAM_RANGES } from '../routing/core/walk';
import { useAppStore } from './store';

const initial = useAppStore.getState();

describe('store', () => {
  beforeEach(() => useAppStore.setState(initial, true));

  it('adds, moves and removes waypoints', () => {
    const s = () => useAppStore.getState();
    s().addWaypoint([77.45, 18.44]);
    s().addWaypoint([77.4, 18.46]);
    expect(s().waypoints).toHaveLength(2);
    s().moveWaypoint(1, [77.39, 18.47]);
    expect(s().waypoints[1]).toEqual([77.39, 18.47]);
    s().moveWaypoint(9, [0, 0]);
    expect(s().waypoints).toHaveLength(2);
    s().removeWaypoint(0);
    expect(s().waypoints).toEqual([[77.39, 18.47]]);
    s().setWaypoints([]);
    expect(s().waypoints).toEqual([]);
  });

  it('toggles layers', () => {
    const s = () => useAppStore.getState();
    const base = s().activeLayers;
    s().toggleLayer('hirise');
    s().toggleLayer('themis');
    s().toggleLayer('hirise');
    expect(s().activeLayers).toEqual([...base, 'themis']);
  });

  it('opens with the CTX base and HiRISE detail, and clamps the opacity', () => {
    const s = () => useAppStore.getState();
    expect(s().activeLayers).toEqual(expect.arrayContaining(['ctx-jezero', 'hirise-jezero']));
    s().toggleLayer('themis-dia');
    s().setBaseLayer('ctx-jezero');
    expect(s().activeLayers).toEqual(expect.arrayContaining(['ctx-jezero', 'themis-dia']));
    s().setLayerOpacity('themis-dia', 3);
    expect(s().layerOpacity['themis-dia']).toBe(1);
  });

  it('stores status, selection, hover and route', () => {
    const s = () => useAppStore.getState();
    s().setRouteStatus('computing');
    s().selectTarget('amostra');
    s().setHoverProfileIndex(3);
    s().setRoute(null);
    expect(s().routeStatus).toBe('computing');
    expect(s().selectedTargetId).toBe('amostra');
    expect(s().hoverProfileIndex).toBe(3);
    expect(s().route).toBeNull();
  });

  it('dims outside the planning area by default and can toggle it', () => {
    const s = () => useAppStore.getState();
    expect(s().focusPlanningArea).toBe(true);
    s().setFocusPlanningArea(false);
    expect(s().focusPlanningArea).toBe(false);
    s().setFocusPlanningArea(true);
  });

  it('evaParams: defaults, partial merge and clamping', () => {
    const s = () => useAppStore.getState();
    expect(s().evaParams).toEqual(DEFAULT_EVA_PARAMS);
    s().setEvaParams({ loadMassKg: 120 });
    expect(s().evaParams).toEqual({ ...DEFAULT_EVA_PARAMS, loadMassKg: 120 });
    s().setEvaParams({ speedFlatMS: 100, o2_available_kg: -5 });
    expect(s().evaParams.speedFlatMS).toBe(EVA_PARAM_RANGES.speedFlatMS.max);
    expect(s().evaParams.o2_available_kg).toBe(EVA_PARAM_RANGES.o2_available_kg.min);
    s().setEvaParams({ speedFlatMS: NaN });
    expect(s().evaParams.speedFlatMS).toBe(EVA_PARAM_RANGES.speedFlatMS.max);
  });
});
