import { useEffect, useMemo } from 'react';
import { useAppStore } from '../state/store';
import { useSimulationStore } from '../state/simulationStore';
import { buildTimeline, simulationStateAt, type SimulationState } from './simulation';

/**
 * Drives the EVA clock with `requestAnimationFrame` while the simulation is running.
 * The loop stops when the simulation pauses, finishes or resets, and on unmount.
 * Mount it once (the control does).
 */
export function useSimulationClock(): void {
  const status = useSimulationStore((s) => s.status);
  const route = useAppStore((s) => s.route);
  const totalS = route?.properties.time_s ?? 0;

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
  const route = useAppStore((s) => s.route);
  const t_s = useSimulationStore((s) => s.t_s);
  const timeline = useMemo(
    () => (route && route.geometry.coordinates.length >= 2 ? buildTimeline(route) : null),
    [route],
  );
  return useMemo(() => (route && timeline ? simulationStateAt(timeline, route, t_s) : null), [route, timeline, t_s]);
}
