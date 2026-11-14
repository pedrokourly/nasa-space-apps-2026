import { create } from 'zustand';
import type { LonLat } from '../lib/mars-geo';
import type { LayerId, Route, RouteStatus } from '../types/contract';

export interface AppState {
  waypoints: LonLat[];
  route: Route | null;
  routeStatus: RouteStatus;
  selectedTargetId: string | null;
  hoverProfileIndex: number | null;
  activeLayers: LayerId[];

  setWaypoints: (pts: LonLat[]) => void;
  addWaypoint: (p: LonLat) => void;
  moveWaypoint: (i: number, p: LonLat) => void;
  removeWaypoint: (i: number) => void;
  setRoute: (r: Route | null) => void;
  setRouteStatus: (s: RouteStatus) => void;
  selectTarget: (id: string | null) => void;
  setHoverProfileIndex: (i: number | null) => void;
  toggleLayer: (id: LayerId) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  waypoints: [],
  route: null,
  routeStatus: 'idle',
  selectedTargetId: null,
  hoverProfileIndex: null,
  activeLayers: [],

  setWaypoints: (waypoints) => set({ waypoints }),
  addWaypoint: (p) => set((s) => ({ waypoints: [...s.waypoints, p] })),
  moveWaypoint: (i, p) =>
    set((s) => (i < 0 || i >= s.waypoints.length ? s : { waypoints: s.waypoints.map((w, k) => (k === i ? p : w)) })),
  removeWaypoint: (i) => set((s) => ({ waypoints: s.waypoints.filter((_, k) => k !== i) })),
  setRoute: (route) => set({ route }),
  setRouteStatus: (routeStatus) => set({ routeStatus }),
  selectTarget: (selectedTargetId) => set({ selectedTargetId }),
  setHoverProfileIndex: (hoverProfileIndex) => set({ hoverProfileIndex }),
  toggleLayer: (id) =>
    set((s) => ({
      activeLayers: s.activeLayers.includes(id) ? s.activeLayers.filter((l) => l !== id) : [...s.activeLayers, id],
    })),
}));
