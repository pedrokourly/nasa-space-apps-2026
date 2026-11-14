import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './store';
import { useSimulationStore } from './simulationStore';
import type { Route } from '../types/contract';

const route: Route = {
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: [
      [77, 18],
      [77.001, 18],
    ],
  },
  properties: { dist_m: 60, time_s: 100, o2_kg: 0.1, profile: [[0, 0], [60, 0]] },
};

beforeEach(() => {
  useAppStore.setState({ route: null, waypoints: [] });
  useSimulationStore.getState().reset();
});

describe('simulation store', () => {
  it('runs, pauses, resumes and finishes at the route time', () => {
    const sim = useSimulationStore.getState();
    sim.start();
    expect(useSimulationStore.getState().status).toBe('running');
    sim.advance(0.1, 100); // 0.1 s * 300 = 30 s
    expect(useSimulationStore.getState().t_s).toBeCloseTo(30);
    sim.pause();
    sim.advance(1, 100);
    expect(useSimulationStore.getState().t_s).toBeCloseTo(30);
    sim.resume();
    sim.advance(10, 100);
    expect(useSimulationStore.getState()).toMatchObject({ status: 'finished', t_s: 100 });
  });

  it('resets when the route changes', () => {
    useAppStore.setState({ route });
    useSimulationStore.getState().start();
    useSimulationStore.getState().advance(0.1, 100);
    useAppStore.getState().setRoute({ ...route });
    expect(useSimulationStore.getState()).toMatchObject({ status: 'idle', t_s: 0 });
  });

  it('resets when the waypoints change', () => {
    useSimulationStore.getState().start();
    useAppStore.getState().addWaypoint([77, 18]);
    expect(useSimulationStore.getState().status).toBe('idle');
  });
});
