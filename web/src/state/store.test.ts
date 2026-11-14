import { beforeEach, describe, expect, it } from 'vitest';
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

  it('switches the base keeping overlays and clamps the opacity', () => {
    const s = () => useAppStore.getState();
    s().toggleLayer('themis-dia');
    s().setBaseLayer('hirise-jezero');
    expect(s().activeLayers).toEqual(['hirise-jezero', 'themis-dia']);
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
});
