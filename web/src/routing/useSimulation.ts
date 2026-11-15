import { useEffect, useMemo } from 'react';
import { useAppStore } from '../state/store';
import { useSimulationStore } from '../state/simulationStore';
import {
  availablePlans,
  buildSimPath,
  defaultPlan,
  simulationStateAt,
  type SimPath,
  type SimPlan,
  type SimulationState,
} from './simulation';

/**
 * The plan the simulation actually walks: the selected one, or the default when the route no
 * longer offers it (the store catches up on the next route change).
 */
export function useActivePlan(): { plan: SimPlan; plans: SimPlan[] } {
  const route = useAppStore((s) => s.route);
  const selected = useSimulationStore((s) => s.plan);
  const plans = useMemo(() => availablePlans(route), [route]);
  const plan = plans.includes(selected) ? selected : defaultPlan(route);
  return { plan, plans };
}

/** Simulated path of the selected plan, or `null` when there is no usable route. */
export function useSimulationPath(): SimPath | null {
  const route = useAppStore((s) => s.route);
  const { plan } = useActivePlan();
  return useMemo(
    () => (route && route.geometry.coordinates.length >= 2 ? buildSimPath(route, plan) : null),
    [route, plan],
  );
}

/**
 * Drives the EVA clock with `requestAnimationFrame` while the simulation is running.
 * The loop stops when the simulation pauses, finishes or resets, and on unmount.
 * Mount it once (the control does).
 */
export function useSimulationClock(): void {
  const status = useSimulationStore((s) => s.status);
  const path = useSimulationPath();
  const totalS = path?.time_s.at(-1) ?? 0;

  useEffect(() => {
    if (status !== 'running') return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      // Cap the step so a background tab does not teleport the astronaut on return.
      const dtS = Math.min(0.25, (now - last) / 1000);
      last = now;
      useSimulationStore.getState().advance(dtS, totalS);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [status, totalS]);
}

/** Current simulated EVA state, or `null` when there is no usable route. */
export function useSimulationSnapshot(): SimulationState | null {
  const path = useSimulationPath();
  const t_s = useSimulationStore((s) => s.t_s);
  // Same O₂ supply the route was computed with (issue #61), so the readout matches the verdict.
  const o2Available = useAppStore((s) => s.evaParams.o2_available_kg);
  return useMemo(() => (path ? simulationStateAt(path, t_s, o2Available) : null), [path, t_s, o2Available]);
}
