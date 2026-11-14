import { useEffect } from 'react';
import type { LonLat } from '../lib/mars-geo';
import { useAppStore } from '../state/store';
import { StaleRouteError } from './api';
import { createRouteClient } from './client';

const DEBOUNCE_MS = 150;

/** Observa `waypoints` e mantém `route`, `routeStatus` e `routeError` do store atualizados via Worker. */
export function useRouting(): void {
  useEffect(() => {
    const client = createRouteClient();
    let timer: number | undefined;

    const apply = (points: LonLat[]) => {
      window.clearTimeout(timer);
      if (points.length < 2) {
        client.cancel();
        const s = useAppStore.getState();
        s.setRoute(null);
        s.setRouteError(null);
        s.setRouteStatus('idle');
        return;
      }
      timer = window.setTimeout(() => {
        const st = useAppStore.getState();
        st.setRouteError(null);
        st.setRouteStatus('computing');
        client.route(points).then(
          (route) => {
            const cur = useAppStore.getState();
            cur.setRoute(route);
            cur.setRouteStatus('ready');
          },
          (e: unknown) => {
            if (e instanceof StaleRouteError) return;
            const cur = useAppStore.getState();
            cur.setRoute(null);
            cur.setRouteError(e instanceof Error ? e.message : String(e));
            cur.setRouteStatus('error');
          },
        );
      }, DEBOUNCE_MS);
    };

    apply(useAppStore.getState().waypoints);
    const unsub = useAppStore.subscribe((s, prev) => {
      if (s.waypoints !== prev.waypoints) apply(s.waypoints);
    });

    return () => {
      unsub();
      window.clearTimeout(timer);
      client.terminate();
    };
  }, []);
}
