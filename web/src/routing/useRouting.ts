import { useEffect } from 'react';
import type { LonLat } from '../lib/mars-geo';
import { useAppStore } from '../state/store';
import type { EvaParams } from './core/walk';
import { StaleRouteError } from './api';
import { createRouteClient } from './client';
import { routeErrorText } from './respond';

const DEBOUNCE_MS = 150;

/** Watches `waypoints` and keeps the store's `route`, `routeStatus` and `routeError` updated via the Worker. */
export function useRouting(): void {
  useEffect(() => {
    const client = createRouteClient();
    let timer: number | undefined;

    const apply = (points: LonLat[], params: EvaParams) => {
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
        client.route(points, params).then(
          (route) => {
            const cur = useAppStore.getState();
            cur.setRoute(route);
            cur.setRouteStatus('ready');
          },
          (e: unknown) => {
            if (e instanceof StaleRouteError) return;
            const cur = useAppStore.getState();
            cur.setRoute(null);
            cur.setRouteError(routeErrorText(e));
            cur.setRouteStatus('error');
          },
        );
      }, DEBOUNCE_MS);
    };

    const init = useAppStore.getState();
    apply(init.waypoints, init.evaParams);
    const unsub = useAppStore.subscribe((s, prev) => {
      if (s.waypoints !== prev.waypoints || s.evaParams !== prev.evaParams) apply(s.waypoints, s.evaParams);
    });

    return () => {
      unsub();
      window.clearTimeout(timer);
      client.terminate();
    };
  }, []);
}
