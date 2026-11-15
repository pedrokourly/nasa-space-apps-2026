import { useAppStore } from '../state/store';
import { useSimulationStore } from '../state/simulationStore';
import { profilePointAt } from '../routing/profilePoint';
import type { ReturnPath, Route } from '../types/contract';
import { ASSUMPTIONS_URL, COMPUTED_LABEL, ESTIMATE_LABEL, PNR_EXPLANATION, assumptionsLine } from '../routing/estimateText';
import './RouteSummary.css';

/** Map label of the stop at route vertex `vertex`: 'A' for the start, then 1, 2… as the waypoint markers. */
function stopLabel(route: Route, vertex: number): string {
  if (vertex === 0) return 'A';
  const i = (route.properties.legs ?? []).findIndex((l) => l.to_vertex === vertex);
  return i >= 0 ? String(i + 1) : String(vertex);
}

/** Text of the return estimate: from the last stop before the point of no return on NO-GO. */
function returnLabel(route: Route, ret: ReturnPath, nogo: boolean): string {
  return nogo ? `Return from stop ${stopLabel(route, ret.from_vertex)} (estimate)` : 'Return (estimate)';
}

interface VerdictLineProps {
  route: Route;
  who: 'Habitat' | 'Start';
  verdict: 'GO' | 'NO-GO';
  /** Distance (km) of the point of no return along the route, on NO-GO. */
  turnBackKm: number | null;
  /** Even the start cannot reach this destination with the O₂ available. */
  unreachable: boolean;
  ret: ReturnPath | undefined;
  /** Picks the swatch color: amber (habitat) or green (start), as on the map. */
  kind: 'habitat' | 'start';
}

/** One compact verdict line of the two-verdict summary (habitat or start point). */
function VerdictLine({ route, who, verdict, turnBackKm, unreachable, ret, kind }: VerdictLineProps) {
  const nogo = verdict === 'NO-GO';
  return (
    <span className="route-summary__line">
      <span className="route-summary__who">{who}</span>
      <span className={`route-summary__verdict route-summary__verdict--${nogo ? 'nogo' : 'go'}`}>{verdict}</span>
      {unreachable && <span className="route-summary__pnr">Start is too far from the habitat for the available O₂ (estimate)</span>}
      {turnBackKm !== null && <span className="route-summary__pnr">Point of no return at {turnBackKm.toFixed(2)} km</span>}
      {ret && (
        <span className={`route-summary__return route-summary__return--${kind}`}>
          <span className="route-summary__return-swatch" aria-hidden="true" />
          {returnLabel(route, ret, nogo)}: {(ret.dist_m / 1000).toFixed(1)} km ·{' '}
          {Math.round(ret.time_s / 60)} min · {ret.o2_kg.toFixed(2)} kg O₂
        </span>
      )}
      {!ret && nogo && !unreachable && <span className="route-summary__note">Turn back at the start</span>}
      {!ret && !nogo && <span className="route-summary__note">Route ends at the {kind === 'habitat' ? 'habitat' : 'start'}</span>}
    </span>
  );
}

/** Minimal route status indicator and summary (the full panel belongs to the UI workstream). */
export default function RouteSummary() {
  const status = useAppStore((s) => s.routeStatus);
  const route = useAppStore((s) => s.route);
  const error = useAppStore((s) => s.routeError);
  const o2Available = useAppStore((s) => s.evaParams.o2_available_kg);
  const simulationStatus = useSimulationStore((s) => s.status);
  const liveClass = simulationStatus === 'idle' ? '' : ' route-summary--live';

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
  const ret = p.return_path;
  const nogo = p.verdict === 'NO-GO';
  // Point of no return 0: even the start cannot reach the habitat, so there is nothing to turn back by.
  const startUnreachable = nogo && (p.start_unreachable === true || p.point_of_no_return === 0);
  const pnr = nogo && !startUnreachable ? profilePointAt(route, p.point_of_no_return) : null;
  const toStart = p.return_to_start;
  const anyNogo = nogo || toStart?.verdict === 'NO-GO';

  // Decision 0002: distance is computed from terrain data; time, O₂ and the verdicts are estimates.
  const labels = (
    <>
      <p className="route-summary__labels">
        Distance: {COMPUTED_LABEL}. Time, O₂ and verdict: {ESTIMATE_LABEL} ({assumptionsLine(o2Available)}).{' '}
        <a href={ASSUMPTIONS_URL} target="_blank" rel="noopener noreferrer">
          Assumptions
        </a>
      </p>
      {anyNogo && <p className="route-summary__labels route-summary__labels--pnr">Point of no return: {PNR_EXPLANATION}</p>}
    </>
  );

  // Route not starting at the habitat: totals on top, then one compact line per verdict.
  if (toStart && p.verdict) {
    const startNogo = toStart.verdict === 'NO-GO';
    const startPnr = startNogo ? profilePointAt(route, toStart.point_of_no_return) : null;
    return (
      <div className={`route-summary route-summary--info route-summary--dual${liveClass}`} role="status" aria-live="polite">
        <span className="route-summary__totals">
          {km} km · {min} min · {o2} kg O₂{p.mock ? ' (mock)' : ''}
        </span>
        <VerdictLine
          route={route}
          who="Habitat"
          verdict={p.verdict}
          turnBackKm={pnr ? pnr.dist_m / 1000 : null}
          unreachable={startUnreachable}
          ret={startUnreachable ? undefined : ret}
          kind="habitat"
        />
        <VerdictLine
          route={route}
          who="Start"
          verdict={toStart.verdict}
          turnBackKm={startPnr ? startPnr.dist_m / 1000 : null}
          unreachable={false}
          ret={toStart.return_path}
          kind="start"
        />
        {labels}
      </div>
    );
  }

  return (
    <div className={`route-summary route-summary--info route-summary--stacked${liveClass}`} role="status" aria-live="polite">
      <div className="route-summary__line">
      {p.verdict && (
        <span className={`route-summary__verdict route-summary__verdict--${p.verdict === 'GO' ? 'go' : 'nogo'}`}>
          {p.verdict}
        </span>
      )}
      <span>
        {km} km · {min} min · {o2} kg O₂{p.mock ? ' (mock)' : ''}
      </span>
      {startUnreachable && (
        <span className="route-summary__pnr">Start is too far from the habitat for the available O₂ (estimate)</span>
      )}
      {pnr && <span className="route-summary__pnr">Point of no return at {(pnr.dist_m / 1000).toFixed(2)} km</span>}
      {ret && !startUnreachable && (
        <span className="route-summary__return">
          <span className="route-summary__return-swatch" aria-hidden="true" />
          {returnLabel(route, ret, nogo)}: {(ret.dist_m / 1000).toFixed(1)} km ·{' '}
          {Math.round(ret.time_s / 60)} min · {ret.o2_kg.toFixed(2)} kg O₂
        </span>
      )}
      </div>
      {labels}
    </div>
  );
}
