import { create } from 'zustand';
import { useAppStore } from './store';
import { availablePlans, defaultPlan, type SimPlan } from '../routing/simulation';

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'finished';

/** Default compression: 1 real second = 5 EVA minutes (300 EVA seconds). */
export const DEFAULT_TIME_MULTIPLIER = 300;

export interface SimulationState {
  status: SimulationStatus;
  /** Elapsed EVA time (s) since departure. */
  t_s: number;
  /** EVA seconds that pass per real second. */
  timeMultiplier: number;
  /**
   * Plan the simulation walks (issue #71). Follows the default (return to the habitat when the
   * route has one) until the user picks one; falls back to the default when the picked plan stops
   * being available for the current route.
   */
  plan: SimPlan;
  /** `true` once the user has picked a plan, so a new route does not override the choice. */
  planPicked: boolean;

  /** Starts (or restarts) the EVA from the start of the plan. */
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setTimeMultiplier: (m: number) => void;
  /** Picks the plan to walk and resets the simulation. Plans the route does not offer are ignored. */
  setPlan: (plan: SimPlan) => void;
  /**
   * Advances the clock by `realDtS` real seconds, capped at `totalS` (the plan's time).
   * Marks the simulation as finished when the end is reached. No-op unless running.
   */
  advance: (realDtS: number, totalS: number) => void;
}

export const useSimulationStore = create<SimulationState>()((set) => ({
  status: 'idle',
  t_s: 0,
  timeMultiplier: DEFAULT_TIME_MULTIPLIER,
  plan: 'route',
  planPicked: false,

  start: () => set({ status: 'running', t_s: 0 }),
  pause: () => set((s) => (s.status === 'running' ? { status: 'paused' } : s)),
  resume: () => set((s) => (s.status === 'paused' ? { status: 'running' } : s)),
  reset: () => set({ status: 'idle', t_s: 0 }),
  setTimeMultiplier: (m) => set({ timeMultiplier: Number.isFinite(m) && m > 0 ? m : DEFAULT_TIME_MULTIPLIER }),
  setPlan: (plan) =>
    set((s) => {
      if (!availablePlans(useAppStore.getState().route).includes(plan)) return s;
      return { plan, planPicked: true, status: 'idle', t_s: 0 };
    }),
  advance: (realDtS, totalS) =>
    set((s) => {
      if (s.status !== 'running') return s;
      const t_s = Math.min(totalS, s.t_s + Math.max(0, realDtS) * s.timeMultiplier);
      return t_s >= totalS ? { t_s: totalS, status: 'finished' } : { t_s };
    }),
}));

// A new route or new waypoints invalidate the simulation (kept out of `store.ts` on purpose).
useAppStore.subscribe((state, prev) => {
  if (state.route === prev.route && state.waypoints === prev.waypoints) return;
  const sim = useSimulationStore.getState();
  if (state.route !== prev.route) {
    // Keep the user's pick while it is still offered; otherwise go back to the default plan.
    const keep = sim.planPicked && availablePlans(state.route).includes(sim.plan);
    const plan = keep ? sim.plan : defaultPlan(state.route);
    if (plan !== sim.plan || sim.planPicked !== keep) useSimulationStore.setState({ plan, planPicked: keep });
  }
  if (sim.status !== 'idle') sim.reset();
});
