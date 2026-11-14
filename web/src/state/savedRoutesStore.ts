import { create } from 'zustand';
import type { LonLat } from '../lib/mars-geo';
import {
  getBrowserStorage,
  listSavedRoutes,
  patchSavedRoute,
  removeSavedRoute,
  renameSavedRoute as renameInStorage,
  saveRoute,
  type SavedRoute,
  type SavedRouteSummary,
  type StorageLike,
} from './savedRoutes';
import { useAppStore } from './store';

export interface SavedRoutesState {
  /** Saved routes, oldest first. Empty when nothing is saved or storage is unavailable. */
  savedRoutes: SavedRoute[];
  /** Saves the current `waypoints` (and the route summary, if computed). Returns null with no waypoints or on write failure. */
  saveCurrentRoute: (name: string) => SavedRoute | null;
  renameSavedRoute: (id: string, name: string) => void;
  /** Overwrites a saved route with the current waypoints and summary. */
  updateSavedRoute: (id: string) => void;
  deleteSavedRoute: (id: string) => void;
  /** Replaces the app's waypoints with the saved ones; routing recomputes. */
  loadSavedRoute: (id: string) => void;
  /** Re-reads the list from storage. */
  refreshSavedRoutes: () => void;
}

function currentSnapshot(): { waypoints: LonLat[]; summary: SavedRouteSummary | null } {
  const { waypoints, route } = useAppStore.getState();
  const p = route?.properties;
  const summary: SavedRouteSummary | null = p
    ? { dist_m: p.dist_m, time_s: p.time_s, o2_kg: p.o2_kg, ...(p.verdict ? { verdict: p.verdict } : {}) }
    : null;
  return { waypoints, summary };
}

/** Creates a saved-routes store over the given storage (injectable for tests). */
export function createSavedRoutesStore(getStorage: () => StorageLike | null = getBrowserStorage) {
  return create<SavedRoutesState>()((set) => {
    const refresh = () => set({ savedRoutes: listSavedRoutes(getStorage()) });
    return {
      savedRoutes: listSavedRoutes(getStorage()),
      saveCurrentRoute: (name) => {
        const snap = currentSnapshot();
        if (snap.waypoints.length === 0) return null;
        const saved = saveRoute(getStorage(), { name, ...snap });
        refresh();
        return saved;
      },
      renameSavedRoute: (id, name) => {
        renameInStorage(getStorage(), id, name);
        refresh();
      },
      updateSavedRoute: (id) => {
        const snap = currentSnapshot();
        if (snap.waypoints.length > 0) patchSavedRoute(getStorage(), id, snap);
        refresh();
      },
      deleteSavedRoute: (id) => {
        removeSavedRoute(getStorage(), id);
        refresh();
      },
      loadSavedRoute: (id) => {
        const found = listSavedRoutes(getStorage()).find((r) => r.id === id);
        if (found) useAppStore.getState().setWaypoints(found.waypoints.map(([lon, lat]) => [lon, lat] as LonLat));
        refresh();
      },
      refreshSavedRoutes: refresh,
    };
  });
}

/**
 * Saved routes, persisted in `localStorage` under `martian-map.saved-routes.v1`.
 *
 * API for the UI workstream (no UI lives here):
 * - `savedRoutes`: list of `{ id, name, waypoints, createdAt, updatedAt, summary }`; `summary`
 *   holds `dist_m`, `time_s`, `o2_kg`, `verdict` of the route at save time (null if none computed).
 * - `saveCurrentRoute(name)`, `updateSavedRoute(id)`: read waypoints and route from `useAppStore`.
 * - `renameSavedRoute(id, name)`, `deleteSavedRoute(id)`.
 * - `loadSavedRoute(id)`: calls `setWaypoints`, so the route is recomputed and redrawn.
 * Corrupt or blocked storage never throws: the list is simply empty.
 */
export const useSavedRoutesStore = createSavedRoutesStore();
