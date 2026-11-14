import { useEffect } from 'react';
import type { LonLat } from '../lib/mars-geo';
import { encodeRouteHash, parseRouteHash } from '../lib/routeHash';
import { useAppStore } from './store';

function writeHash(waypoints: readonly LonLat[]): void {
  const hash = encodeRouteHash(waypoints);
  if (hash === window.location.hash) return;
  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search + hash);
  } catch {
    // Ignore: history may be unavailable (sandboxed frames).
  }
}

/** Loads the route from `location.hash` on mount and keeps the hash in sync with the waypoints. */
export function useRouteHashSync(): void {
  useEffect(() => {
    const initial = parseRouteHash(window.location.hash);
    if (initial) useAppStore.getState().setWaypoints(initial);
    // Normalizes a valid hash and drops an invalid one.
    writeHash(useAppStore.getState().waypoints);
    return useAppStore.subscribe((s, prev) => {
      if (s.waypoints !== prev.waypoints) writeHash(s.waypoints);
    });
  }, []);
}
