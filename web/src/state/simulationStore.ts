import { create } from 'zustand';
import { useAppStore } from './store';

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'finished';

/** Default compression: 1 real second = 5 EVA minutes (300 EVA seconds). */
export const DEFAULT_TIME_MULTIPLIER = 300;

export interface SimulationState {
  status: SimulationStatus;
  /** Elapsed EVA time (s) since departure. */
  t_s: number;
  /** EVA seconds that pass per real second. */
  timeMultiplier: number;

  /** Starts (or restarts) the EVA from the habitat. */
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setTimeMultiplier: (m: number) => void;
  /**
   * Advances the clock by `realDtS` real seconds, capped at `totalS` (the route time).
   * Marks the simulation as finished when the end is reached. No-op unless running.
   */
  advance: (realDtS: number, totalS: number) => void;
}

export const useSimulationStore = create<SimulationState>()((set) => ({
  status: 'idle',
  t_s: 0,
  timeMultiplier: DEFAULT_TIME_MULTIPLIER,

  start: () => set({ status: 'running', t_s: 0 }),
  pause: () => set((s) => (s.status === 'running' ? { status: 'paused' } : s)),
  resume: () => set((s) => (s.status === 'paused' ? { status: 'running' } : s)),
  reset: () => set({ status: 'idle', t_s: 0 }),
  setTimeMultiplier: (m) => set({ timeMultiplier: Number.isFinite(m) && m > 0 ? m : DEFAULT_TIME_MULTIPLIER }),
  advance: (realDtS, totalS) =>
    set((s) => {
      if (s.status !== 'running') return s;
      const t_s = Math.min(totalS, s.t_s + Math.max(0, realDtS) * s.timeMultiplier);
      return t_s >= totalS ? { t_s: totalS, status: 'finished' } : { t_s };
    }),
}));

// A new route or new waypoints invalidate the simulation (kept out of `store.ts` on purpose).
useAppStore.subscribe((state, prev) => {
  if (state.route !== prev.route || state.waypoints !== prev.waypoints) {
    if (useSimulationStore.getState().status !== 'idle') useSimulationStore.getState().reset();
  }
});
