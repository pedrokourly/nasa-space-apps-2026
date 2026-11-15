import { useMemo, useSyncExternalStore } from 'react';
import { useAppStore } from '../state/store';
import { useSimulationStore } from '../state/simulationStore';
import { profilePointAt } from '../routing/profilePoint';
import { availablePlans, buildSimPath, SIM_PLAN_LABELS, type SimPlan } from '../routing/simulation';
import type { ReturnPath, Route } from '../types/contract';
import { ASSUMPTIONS_URL, COMPUTED_LABEL, ESTIMATE_LABEL, PNR_EXPLANATION, assumptionsLine } from '../routing/estimateText';
import { RESERVE_NOTE } from './reserveNote';
import { Badge } from './kit';
import './RouteSummary.css';

type Verdict = 'GO' | 'NO-GO';

/** Screens up to 768 px: the estimate notes start collapsed behind "Assumptions" (UI review, decision 4). */
const NARROW_QUERY = '(max-width: 768px)';

function useNarrowScreen(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(NARROW_QUERY);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false,
  );
}

/** Map label of the stop at route vertex `vertex`: 'A' for the start, then 1, 2… as the waypoint markers. */
function stopLabel(route: Route, vertex: number): string {
  if (vertex === 0) return 'A';
  const i = (route.properties.legs ?? []).findIndex((l) => l.to_vertex === vertex);
  return i >= 0 ? String(i + 1) : String(vertex);
}

/** Text of a return estimate: from the last stop before the point of no return on NO-GO. */
function returnText(route: Route, ret: ReturnPath, nogo: boolean): string {
  const from = nogo ? `Return from stop ${stopLabel(route, ret.from_vertex)}` : 'Return';
  return `${from} (estimate): ${(ret.dist_m / 1000).toFixed(1)} km · ${Math.round(ret.time_s / 60)} min · ${ret.o2_kg.toFixed(2)} kg O₂`;
}

function VerdictPill({ verdict }: { verdict: Verdict | undefined }) {
  if (!verdict) return <span className="route-plans__none">—</span>;
  return <Badge variant={verdict === 'GO' ? 'success' : 'destructive'}>{verdict}</Badge>;
}

interface PlanRow {
  plan: SimPlan;
  verdict: Verdict | undefined;
  /** The way home this plan adds to the route, if any. */
  ret: ReturnPath | undefined;
  nogo: boolean;
  /** Distance (km) of this plan's point of no return along the route, on NO-GO. */
  pnrKm?: number;
}

/**
 * Every plan the route offers (planned route, return to habitat, return to start), shown at once and
 * independent of the plan picked for the EVA simulation. O₂ left = supply − O₂ used.
 */
function PlansTable({ route, rows, o2Available }: { route: Route; rows: PlanRow[]; o2Available: number }) {
  const paths = useMemo(() => new Map(availablePlans(route).map((plan) => [plan, buildSimPath(route, plan)])), [route]);
  return (
    <table className="route-plans">
      <thead>
        <tr>
          <th scope="col">Plan</th>
          <th scope="col">Verdict</th>
          <th scope="col" className="route-plans__num">Distance</th>
          <th scope="col" className="route-plans__num">Time</th>
          <th scope="col" className="route-plans__num">O₂ used</th>
          <th scope="col" className="route-plans__num">
            O₂ left<span className="route-plans__note">{RESERVE_NOTE}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ plan, verdict, ret, nogo, pnrKm }) => {
          const path = paths.get(plan);
          if (!path) return null;
          const used = path.o2_kg.at(-1) ?? 0;
          return (
            <tr key={plan} className={`route-plans__row route-plans__row--${plan}`} title={ret ? returnText(route, ret, nogo) : undefined}>
              <th scope="row">
                <span className="route-plans__name">
                  <span className="route-plans__swatch" aria-hidden="true" />
                  {SIM_PLAN_LABELS[plan]}
                </span>
                {pnrKm !== undefined && (
                  <span className="route-plans__sub route-plans__sub--pnr">Point of no return at {pnrKm.toFixed(2)} km</span>
                )}
                {ret && nogo && <span className="route-plans__sub">{returnText(route, ret, nogo)}</span>}
              </th>
              <td className="route-plans__verdict"><VerdictPill verdict={verdict} /></td>
              <td className="route-plans__num" data-label="Distance">{((path.dist_m.at(-1) ?? 0) / 1000).toFixed(1)} km</td>
              <td className="route-plans__num" data-label="Time">{Math.round((path.time_s.at(-1) ?? 0) / 60)} min</td>
              <td className="route-plans__num" data-label="O₂ used">{used.toFixed(2)} kg</td>
              <td className="route-plans__num" data-label={`O₂ left (${RESERVE_NOTE})`}>{Math.max(0, o2Available - used).toFixed(2)} kg</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Route status and summary: every plan with its verdict, the warnings, and the decision 0002 labels. */
export default function RouteSummary() {
  const status = useAppStore((s) => s.routeStatus);
  const route = useAppStore((s) => s.route);
  const error = useAppStore((s) => s.routeError);
  const o2Available = useAppStore((s) => s.evaParams.o2_available_kg);
  const simulationStatus = useSimulationStore((s) => s.status);
  const narrow = useNarrowScreen();
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
  const nogo = p.verdict === 'NO-GO';
  // Point of no return 0: even the start cannot reach the habitat, so there is nothing to turn back by.
  const startUnreachable = nogo && (p.start_unreachable === true || p.point_of_no_return === 0);
  const pnr = nogo && !startUnreachable ? profilePointAt(route, p.point_of_no_return) : null;
  const toStart = p.return_to_start;
  const startNogo = toStart?.verdict === 'NO-GO';
  const startPnr = startNogo ? profilePointAt(route, toStart.point_of_no_return) : null;
  const anyNogo = nogo || startNogo;

  // One row per plan. The habitat verdict sits on the "Return to habitat" row, or on the planned
  // route itself when that route already ends at the habitat (no return to add).
  const plans = availablePlans(route);
  const habitatPnrKm = pnr ? pnr.dist_m / 1000 : undefined;
  const hasHabitatRow = plans.includes('habitat');
  const rows: PlanRow[] = plans.map((plan) => {
    if (plan === 'habitat') {
      return { plan, verdict: p.verdict, ret: startUnreachable ? undefined : p.return_path, nogo, pnrKm: habitatPnrKm };
    }
    if (plan === 'start') {
      return { plan, verdict: toStart?.verdict, ret: toStart?.return_path, nogo: startNogo, pnrKm: startPnr ? startPnr.dist_m / 1000 : undefined };
    }
    return { plan, verdict: hasHabitatRow ? undefined : p.verdict, ret: undefined, nogo: false, pnrKm: hasHabitatRow ? undefined : habitatPnrKm };
  });

  // Cases with no row to attach to: the start cannot reach the habitat, or there is no way back at all.
  const warnings: string[] = [];
  if (startUnreachable) warnings.push('The start is too far from the habitat for the available O₂ (estimate)');
  if (nogo && !startUnreachable && !p.return_path) warnings.push('Habitat: turn back at the start');

  return (
    <div className={`route-summary route-summary--info route-summary--card${liveClass}`} role="status" aria-live="polite">
      <PlansTable route={route} rows={rows} o2Available={o2Available} />
      {p.mock && <p className="route-summary__warning">Mock route</p>}
      {warnings.map((w) => (
        <p className="route-summary__warning" key={w}>
          {w}
        </p>
      ))}
      {/* Decision 0002: distance is computed from terrain data; time, O₂ and the verdicts are estimates.
          Open on desktop; on narrow screens one tap away behind "Assumptions" (key re-opens it on resize). */}
      <details className="route-summary__details" open={!narrow} key={narrow ? 'narrow' : 'wide'}>
        <summary>Estimate · Assumptions</summary>
        <p className="route-summary__labels">
          Distance: {COMPUTED_LABEL}. Time, O₂ and verdict: {ESTIMATE_LABEL} ({assumptionsLine(o2Available)}).{' '}
          {anyNogo && <span className="route-summary__pnr-note">Point of no return: {PNR_EXPLANATION} </span>}
          <a href={ASSUMPTIONS_URL} target="_blank" rel="noopener noreferrer">
            Assumptions
          </a>
        </p>
      </details>
    </div>
  );
}
