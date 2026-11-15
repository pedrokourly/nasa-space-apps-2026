import { useEffect } from 'react';
import type { LonLat } from '../lib/mars-geo';
import { useAppStore } from '../state/store';
import type { EvaParams } from './core/walk';
import type { Route } from '../types/contract';
import { StaleRouteError } from './api';
import { createRouteClient } from './client';
import { routeErrorText } from './respond';

const DEBOUNCE_MS = 150;

/**
 * Watches `waypoints`, `evaParams` and `habitat` and keeps the store's `route`, `routeStatus` and
 * `routeError` updated via the Worker. The route follows the order of the waypoints; only a
 * "Best order" request (`bestOrderRequest`) reorders them.
 */
export function useRouting(): void {
  useEffect(() => {
    const client = createRouteClient();
    let timer: number | undefined;

    const succeed = (route: Route) => {
      const cur = useAppStore.getState();
      cur.setRoute(route);
      cur.setRouteStatus('ready');
    };
    const fail = (e: unknown) => {
      if (e instanceof StaleRouteError) return;
      const cur = useAppStore.getState();
      cur.setRoute(null);
      cur.setRouteError(routeErrorText(e));
      cur.setRouteStatus('error');
    };

    const apply = (points: LonLat[], params: EvaParams, habitat: LonLat | null) => {
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
        client.route(points, params, habitat ?? undefined).then(succeed, fail);
      }, DEBOUNCE_MS);
    };

    /** Best order (#65): ask the Worker to reorder the stops, then show them in that order. */
    const reorder = (points: LonLat[], params: EvaParams, habitat: LonLat | null) => {
      if (points.length < 2) return;
      window.clearTimeout(timer);
      const st = useAppStore.getState();
      st.setRouteError(null);
      st.setRouteStatus('computing');
      client.route(points, params, habitat ?? undefined, { optimizeOrder: true }).then((route) => {
        const order = route.properties.stop_order;
        succeed(route);
        // The new waypoints trigger a normal request that returns the same route.
        if (order) useAppStore.getState().setWaypoints(order.map((i) => points[i]!));
      }, fail);
    };

    const init = useAppStore.getState();
    apply(init.waypoints, init.evaParams, init.habitat);
    const unsub = useAppStore.subscribe((s, prev) => {
      if (s.bestOrderRequest !== prev.bestOrderRequest) {
        reorder(s.waypoints, s.evaParams, s.habitat);
        return;
      }
      if (s.waypoints !== prev.waypoints || s.evaParams !== prev.evaParams || s.habitat !== prev.habitat) {
        apply(s.waypoints, s.evaParams, s.habitat);
      }
    });

    return () => {
      unsub();
      window.clearTimeout(timer);
      client.terminate();
    };
  }, []);
}
