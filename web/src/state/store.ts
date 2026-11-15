import { create } from 'zustand';
import type { LonLat } from '../lib/mars-geo';
import type { LayerId, Route, RouteStatus } from '../types/contract';
import { clampEvaParams, DEFAULT_EVA_PARAMS, type EvaParams } from '../routing/core/walk';
import { DEFAULT_ACTIVE_LAYERS, LAYERS } from '../map/layers';

export interface AppState {
  waypoints: LonLat[];
  /**
   * Habitat position (the `habitat` feature of `targets.geojson`): where the way home leads.
   * `null` until the targets load, or when there is none; the router then uses the route's first point.
   */
  habitat: LonLat | null;
  setHabitat: (p: LonLat | null) => void;
  route: Route | null;
  routeStatus: RouteStatus;
  /** Message of the last route error (when `routeStatus === 'error'`). */
  routeError: string | null;
  selectedTargetId: string | null;
  hoverProfileIndex: number | null;
  activeLayers: LayerId[];
  /** Opacity (0 to 1) per layer; missing = the layer's default. */
  layerOpacity: Record<LayerId, number>;

  /** Dims the map outside the EVA planning area (the `meta.json` bbox). */
  focusPlanningArea: boolean;

  /** EVA parameters (ASSUMPTIONS, see `routing/core/walk.ts`); changing them recomputes the route. */
  evaParams: EvaParams;
  /** Merges `partial` into `evaParams`, clamped to `EVA_PARAM_RANGES`; non-finite values are ignored. */
  setEvaParams: (partial: Partial<EvaParams>) => void;

  /** Grows by one each time the planner asks for the best order; `useRouting` reacts to it. */
  bestOrderRequest: number;
  requestBestOrder: () => void;

  setWaypoints: (pts: LonLat[]) => void;
  addWaypoint: (p: LonLat) => void;
  moveWaypoint: (i: number, p: LonLat) => void;
  removeWaypoint: (i: number) => void;
  setRoute: (r: Route | null) => void;
  setRouteStatus: (s: RouteStatus) => void;
  setRouteError: (m: string | null) => void;
  selectTarget: (id: string | null) => void;
  setHoverProfileIndex: (i: number | null) => void;
  toggleLayer: (id: LayerId) => void;
  /** Switches the active base (one at a time), keeping the overlays. */
  setBaseLayer: (id: LayerId) => void;
  setLayerOpacity: (id: LayerId, opacity: number) => void;
  setFocusPlanningArea: (on: boolean) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  waypoints: [],
  habitat: null,
  setHabitat: (habitat) => set({ habitat }),
  route: null,
  routeStatus: 'idle',
  routeError: null,
  selectedTargetId: null,
  hoverProfileIndex: null,
  activeLayers: [...DEFAULT_ACTIVE_LAYERS],
  layerOpacity: Object.fromEntries(
    LAYERS.flatMap((l) => (l.defaultOpacity === undefined ? [] : [[l.id, l.defaultOpacity] as const])),
  ),
  focusPlanningArea: true,

  evaParams: { ...DEFAULT_EVA_PARAMS },
  setEvaParams: (partial) => set((s) => ({ evaParams: { ...s.evaParams, ...clampEvaParams(partial) } })),

  bestOrderRequest: 0,
  requestBestOrder: () => set((s) => ({ bestOrderRequest: s.bestOrderRequest + 1 })),

  setWaypoints: (waypoints) => set({ waypoints }),
  addWaypoint: (p) => set((s) => ({ waypoints: [...s.waypoints, p] })),
  moveWaypoint: (i, p) =>
    set((s) => (i < 0 || i >= s.waypoints.length ? s : { waypoints: s.waypoints.map((w, k) => (k === i ? p : w)) })),
  removeWaypoint: (i) => set((s) => {
    const waypoints = s.waypoints.filter((_, k) => k !== i);
    // A route needs a start and at least one destination; remove the orphaned start as well.
    return { waypoints: s.waypoints.length > 1 && waypoints.length < 2 ? [] : waypoints };
  }),
  setRoute: (route) => set({ route }),
  setRouteStatus: (routeStatus) => set({ routeStatus }),
  setRouteError: (routeError) => set({ routeError }),
  selectTarget: (selectedTargetId) => set({ selectedTargetId }),
  setHoverProfileIndex: (hoverProfileIndex) => set({ hoverProfileIndex }),
  toggleLayer: (id) =>
    set((s) => ({
      activeLayers: s.activeLayers.includes(id) ? s.activeLayers.filter((l) => l !== id) : [...s.activeLayers, id],
    })),
  setBaseLayer: (id) =>
    set((s) => {
      const isBase = (l: LayerId) => LAYERS.some((d) => d.id === l && d.type === 'base');
      return { activeLayers: [id, ...s.activeLayers.filter((l) => !isBase(l))] };
    }),
  setLayerOpacity: (id, opacity) =>
    set((s) => ({ layerOpacity: { ...s.layerOpacity, [id]: Math.min(1, Math.max(0, opacity)) } })),
  setFocusPlanningArea: (focusPlanningArea) => set({ focusPlanningArea }),
}));
