import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './store';

const initial = useAppStore.getState();

describe('store', () => {
  beforeEach(() => useAppStore.setState(initial, true));

  it('adiciona, move e remove waypoints', () => {
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

  it('alterna camadas', () => {
    const s = () => useAppStore.getState();
    s().toggleLayer('hirise');
    s().toggleLayer('themis');
    s().toggleLayer('hirise');
    expect(s().activeLayers).toEqual(['themis']);
  });

  it('guarda status, seleção, hover e rota', () => {
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
});
