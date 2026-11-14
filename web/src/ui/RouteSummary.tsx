import { useAppStore } from '../state/store';
import { profilePointAt } from '../routing/profilePoint';
import './RouteSummary.css';

/** Minimal route status indicator and summary (the full panel belongs to the UI workstream). */
export default function RouteSummary() {
  const status = useAppStore((s) => s.routeStatus);
  const route = useAppStore((s) => s.route);
  const error = useAppStore((s) => s.routeError);

  if (status === 'computing') {
    return (
      <div className="route-summary route-summary--info" role="status" aria-live="polite">
        Computing route…
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="route-summary route-summary--error" role="status" aria-live="polite">
        {error ?? 'Route error: unknown'}
      </div>
    );
  }
  // Any route in the store gets a summary, including routes loaded directly (e.g. samples).
  if (!route) return null;

  const p = route.properties;
  const km = (p.dist_m / 1000).toFixed(1);
  const min = Math.round(p.time_s / 60);
  const o2 = p.o2_kg.toFixed(2);
  const pnr = p.verdict === 'NO-GO' ? profilePointAt(route, p.point_of_no_return) : null;

  return (
    <div className="route-summary route-summary--info" role="status" aria-live="polite">
      {p.verdict && (
        <span className={`route-summary__verdict route-summary__verdict--${p.verdict === 'GO' ? 'go' : 'nogo'}`}>
          {p.verdict}
        </span>
      )}
      <span>
        {km} km · {min} min · {o2} kg O₂{p.mock ? ' (mock)' : ''}
      </span>
      {pnr && <span className="route-summary__pnr">Turn back by {(pnr.dist_m / 1000).toFixed(2)} km</span>}
    </div>
  );
}
