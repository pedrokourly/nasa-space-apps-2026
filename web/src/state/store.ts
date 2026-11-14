import { create } from 'zustand';
import type { LonLat } from '../lib/mars-geo';
import type { LayerId, Route, RouteStatus } from '../types/contract';
import { DEFAULT_BASE_ID, LAYERS } from '../map/layers';

export interface AppState {
  waypoints: LonLat[];
  route: Route | null;
  routeStatus: RouteStatus;
  /** Mensagem do último erro de rota (quando `routeStatus === 'error'`). */
  routeError: string | null;
  selectedTargetId: string | null;
  hoverProfileIndex: number | null;
  activeLayers: LayerId[];
  /** Opacidade (0 a 1) por camada; ausente = padrão da camada. */
  layerOpacity: Record<LayerId, number>;

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
  /** Troca a base ativa (uma por vez), mantendo os overlays. */
  setBaseLayer: (id: LayerId) => void;
  setLayerOpacity: (id: LayerId, opacity: number) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  waypoints: [],
  route: null,
  routeStatus: 'idle',
  routeError: null,
  selectedTargetId: null,
  hoverProfileIndex: null,
  activeLayers: [DEFAULT_BASE_ID],
  layerOpacity: Object.fromEntries(
    LAYERS.flatMap((l) => (l.opacidadePadrao === undefined ? [] : [[l.id, l.opacidadePadrao] as const])),
  ),

  setWaypoints: (waypoints) => set({ waypoints }),
  addWaypoint: (p) => set((s) => ({ waypoints: [...s.waypoints, p] })),
  moveWaypoint: (i, p) =>
    set((s) => (i < 0 || i >= s.waypoints.length ? s : { waypoints: s.waypoints.map((w, k) => (k === i ? p : w)) })),
  removeWaypoint: (i) => set((s) => ({ waypoints: s.waypoints.filter((_, k) => k !== i) })),
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
      const isBase = (l: LayerId) => LAYERS.some((d) => d.id === l && d.tipo === 'base');
      return { activeLayers: [id, ...s.activeLayers.filter((l) => !isBase(l))] };
    }),
  setLayerOpacity: (id, opacity) =>
    set((s) => ({ layerOpacity: { ...s.layerOpacity, [id]: Math.min(1, Math.max(0, opacity)) } })),
}));
