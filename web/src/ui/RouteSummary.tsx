import { useAppStore } from '../state/store';
import { NO_PATH_MESSAGE } from '../routing/api';
import './RouteSummary.css';

/** Minimal route status indicator and summary (the full panel belongs to the UI workstream). */
export default function RouteSummary() {
  const status = useAppStore((s) => s.routeStatus);
  const route = useAppStore((s) => s.route);
  const error = useAppStore((s) => s.routeError);

  let text: string | null = null;
  let kind = 'info';
  if (status === 'computing') text = 'Computing route…';
  else if (status === 'error') {
    kind = 'error';
    text = error === NO_PATH_MESSAGE ? error : `Route error: ${error ?? 'unknown'}`;
  } else if (status === 'ready' && route) {
    const p = route.properties;
    const km = (p.dist_m / 1000).toFixed(1);
    const min = Math.round(p.time_s / 60);
    const o2 = p.o2_kg.toFixed(2);
    text = `${km} km · ${min} min · ${o2} kg O₂${p.mock ? ' (mock)' : ''}`;
  }
  if (!text) return null;

  return (
    <div className={`route-summary route-summary--${kind}`} role="status" aria-live="polite">
      {text}
    </div>
  );
}
