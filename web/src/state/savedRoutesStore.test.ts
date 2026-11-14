import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SAVED_ROUTES_KEY, type StorageLike } from './savedRoutes';
import { createSavedRoutesStore } from './savedRoutesStore';
import { useAppStore } from './store';
import type { Route } from '../types/contract';

class FakeStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

const blocked: StorageLike = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

const route = (verdict: 'GO' | 'NO-GO'): Route => ({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: [[77.4, 18.4], [77.5, 18.5]] },
  properties: { dist_m: 1000, time_s: 900, o2_kg: 0.5, profile: [[0, 0], [1000, 5]], verdict },
});

const initial = useAppStore.getState();

describe('saved routes store', () => {
  let storage: FakeStorage;
  beforeEach(() => {
    useAppStore.setState(initial, true);
    storage = new FakeStorage();
    useAppStore.getState().setWaypoints([[77.4, 18.4], [77.5, 18.5]]);
    useAppStore.getState().setRoute(route('GO'));
  });

  it('saves, lists, renames, updates and deletes', () => {
    const store = createSavedRoutesStore(() => storage);
    const s = () => store.getState();
    expect(s().savedRoutes).toEqual([]);
    const saved = s().saveCurrentRoute('Plan A');
    expect(saved?.summary).toEqual({ dist_m: 1000, time_s: 900, o2_kg: 0.5, verdict: 'GO' });
    expect(s().savedRoutes).toHaveLength(1);

    s().renameSavedRoute(saved!.id, 'Plan B');
    expect(s().savedRoutes[0].name).toBe('Plan B');

    useAppStore.getState().setWaypoints([[77.1, 18.1]]);
    useAppStore.getState().setRoute(route('NO-GO'));
    s().updateSavedRoute(saved!.id);
    expect(s().savedRoutes[0].waypoints).toEqual([[77.1, 18.1]]);
    expect(s().savedRoutes[0].summary?.verdict).toBe('NO-GO');
    expect(s().savedRoutes[0].createdAt).toBe(saved!.createdAt);

    s().deleteSavedRoute(saved!.id);
    expect(s().savedRoutes).toEqual([]);
  });

  it('refuses to save an empty route', () => {
    useAppStore.getState().setWaypoints([]);
    expect(createSavedRoutesStore(() => storage).getState().saveCurrentRoute('x')).toBeNull();
  });

  it('persists after re-creating the store', () => {
    const a = createSavedRoutesStore(() => storage);
    const saved = a.getState().saveCurrentRoute('Plan A')!;
    const b = createSavedRoutesStore(() => storage);
    expect(b.getState().savedRoutes).toEqual([saved]);
  });

  it('loadSavedRoute replaces the app waypoints', () => {
    const store = createSavedRoutesStore(() => storage);
    const saved = store.getState().saveCurrentRoute('Plan A')!;
    useAppStore.getState().setWaypoints([]);
    store.getState().loadSavedRoute(saved.id);
    expect(useAppStore.getState().waypoints).toEqual([[77.4, 18.4], [77.5, 18.5]]);
  });

  it('ignores corrupt, wrong-version and invalid data without throwing', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const raw of ['{not json', '{"version":2,"routes":[]}', '"x"', '{"version":1,"routes":[{"id":1}]}']) {
      storage.data.set(SAVED_ROUTES_KEY, raw);
      expect(createSavedRoutesStore(() => storage).getState().savedRoutes).toEqual([]);
    }
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it('survives blocked or missing storage', () => {
    for (const st of [blocked, null]) {
      const store = createSavedRoutesStore(() => st);
      expect(store.getState().savedRoutes).toEqual([]);
      expect(store.getState().saveCurrentRoute('x')).toBeNull();
      expect(() => {
        store.getState().renameSavedRoute('nope', 'y');
        store.getState().deleteSavedRoute('nope');
        store.getState().loadSavedRoute('nope');
      }).not.toThrow();
    }
  });
});
