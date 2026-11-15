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
  properties: {
    dist_m: 60,
    time_s: 100,
    o2_kg: 0.1,
    profile: [
      [0, 0],
      [60, 0],
    ],
  },
};

const ret = {
  from_vertex: 1,
  coordinates: [[77.001, 18] as [number, number], [77, 18] as [number, number]],
  dist_m: 60,
  time_s: 100,
  o2_kg: 0.1,
};
const withHabitat: Route = { ...route, properties: { ...route.properties, return_path: ret } };
const withBoth: Route = {
  ...route,
  properties: {
    ...route.properties,
    return_path: ret,
    return_to_start: { verdict: 'GO', return_path: ret },
  },
};

beforeEach(() => {
  useAppStore.setState({ route: null, waypoints: [] });
  useSimulationStore.setState({ plan: 'route', planPicked: false });
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

  it('defaults to the return to the habitat when the route has one, else to the route', () => {
    useAppStore.getState().setRoute(route);
    expect(useSimulationStore.getState().plan).toBe('route');
    useAppStore.getState().setRoute(withHabitat);
    expect(useSimulationStore.getState().plan).toBe('habitat');
  });

  it('resets the simulation when the plan changes and ignores plans the route does not offer', () => {
    useAppStore.getState().setRoute(withBoth);
    useSimulationStore.getState().start();
    useSimulationStore.getState().advance(0.1, 100);
    useSimulationStore.getState().setPlan('start');
    expect(useSimulationStore.getState()).toMatchObject({ plan: 'start', status: 'idle', t_s: 0 });
    useAppStore.getState().setRoute(withHabitat);
    useSimulationStore.getState().setPlan('start');
    expect(useSimulationStore.getState().plan).toBe('habitat'); // fell back, 'start' is not offered
  });

  it('keeps the picked plan on a new route while it is offered', () => {
    useAppStore.getState().setRoute(withBoth);
    useSimulationStore.getState().setPlan('route');
    useAppStore.getState().setRoute({ ...withBoth });
    expect(useSimulationStore.getState().plan).toBe('route');
  });

  it('falls back to the default plan when the picked plan stops being available', () => {
    useAppStore.getState().setRoute(withBoth);
    useSimulationStore.getState().setPlan('start');
    useSimulationStore.getState().start();
    useAppStore.getState().setRoute(withHabitat);
    expect(useSimulationStore.getState()).toMatchObject({ plan: 'habitat', status: 'idle', t_s: 0 });
    useAppStore.getState().setRoute(null);
    expect(useSimulationStore.getState().plan).toBe('route');
  });
});
