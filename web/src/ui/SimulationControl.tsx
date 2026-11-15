import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useAppStore } from '../state/store';
import { useSimulationStore } from '../state/simulationStore';
import {
  useActivePlan,
  useSimulationClock,
  useSimulationPath,
  useSimulationSnapshot,
} from '../routing/useSimulation';
import { SIM_PLAN_LABELS, type SimPlan } from '../routing/simulation';
import { formatDistance, formatElapsed } from './simulationFormat';
import './SimulationControl.css';
import type { SimulationStatus } from '../state/simulationStore';

const STATUS_LABELS: Record<SimulationStatus, string> = {
  idle: 'Ready',
  running: 'Running',
  paused: 'Paused',
  finished: 'Finished',
};

/**
 * EVA simulation control (issues #62 and #71): a plan selector (planned route, or the route with
 * its return to the habitat or to the start), Start EVA / Pause / Resume / Reset and a readout of
 * elapsed time, distance and O₂ left. Final styling belongs to the UI workstream.
 * Time and O₂ are estimates derived from the routing walk model (assumption).
 */
export default function SimulationControl() {
  useSimulationClock();
  const hasRoute = useAppStore((s) => s.route !== null && s.route.geometry.coordinates.length >= 2);
  const o2Available = useAppStore((s) => s.evaParams.o2_available_kg);
  const status = useSimulationStore((s) => s.status);
  const start = useSimulationStore((s) => s.start);
  const pause = useSimulationStore((s) => s.pause);
  const resume = useSimulationStore((s) => s.resume);
  const reset = useSimulationStore((s) => s.reset);
  const setPlan = useSimulationStore((s) => s.setPlan);
  const { plan, plans } = useActivePlan();
  const path = useSimulationPath();
  const snap = useSimulationSnapshot();
  const rootRef = useRef<HTMLDivElement>(null);

  // Clicks and scrolls on the control must not reach the map (a click would add a waypoint).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  }, []);

  const showReadout = status !== 'idle' && snap !== null;
  const endO2Left = path ? Math.max(0, o2Available - (path.o2_kg.at(-1) ?? 0)) : null;
  const returnLabel = plan === 'start' ? 'Returning to start' : 'Returning to habitat';

  if (!hasRoute && status === 'idle') return null;

  return (
    <div ref={rootRef} className="sim-control" role="group" aria-label="EVA simulation">
      <p className="sim-control__title">
        EVA simulation
        <span className={`sim-control__status sim-control__status--${status}`}>{STATUS_LABELS[status]}</span>
      </p>
      <div className="sim-control__buttons">
        {hasRoute && plans.length > 1 && (
          <label className="sim-control__plan">
            <span className="sim-control__plan-label">Plan</span>
            <select value={plan} onChange={(e) => setPlan(e.target.value as SimPlan)}>
              {plans.map((p) => (
                <option key={p} value={p}>
                  {SIM_PLAN_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
        )}
        {(status === 'idle' || status === 'finished') && (
          <button type="button" className="sim-control__primary" onClick={start} disabled={!hasRoute}>
            {status === 'finished' ? 'Restart EVA' : 'Start EVA'}
          </button>
        )}
        {status === 'running' && (
          <button type="button" onClick={pause}>
            Pause
          </button>
        )}
        {status === 'paused' && (
          <button type="button" className="sim-control__primary" onClick={resume}>
            Resume
          </button>
        )}
        <button type="button" onClick={reset} disabled={status === 'idle'}>
          Reset
        </button>
      </div>
      {!hasRoute && <p className="sim-control__hint">Compute a route to simulate the EVA.</p>}
      {endO2Left !== null && (
        <p className="sim-control__end">O₂ left at the end (estimate): {endO2Left.toFixed(2)} kg</p>
      )}
      {showReadout && (
        <>
          <dl className="sim-control__readout" aria-live="off">
            <div>
              <dt>Elapsed</dt>
              <dd>{formatElapsed(snap.elapsed_s)} h</dd>
            </div>
            <div>
              <dt>Distance</dt>
              <dd>{formatDistance(snap.dist_m)}</dd>
            </div>
            <div>
              <dt>O₂ left</dt>
              <dd>
                {snap.o2_left_kg.toFixed(2)} kg ({Math.round(snap.o2_left_fraction * 100)}%)
              </dd>
            </div>
          </dl>
          <div className="sim-control__o2" aria-hidden="true">
            <div
              className={`sim-control__o2-bar${
                snap.o2_left_fraction < 0.15
                  ? ' sim-control__o2-bar--critical'
                  : snap.o2_left_fraction < 0.35
                    ? ' sim-control__o2-bar--low'
                    : ''
              }`}
            >
              <span style={{ width: `${Math.round(snap.o2_left_fraction * 100)}%` }} />
            </div>
          </div>
          {snap.pastPointOfNoReturn && (
            <p className="sim-control__warning" role="alert">
              NO-GO: point of no return passed. The remaining O₂ no longer covers the way back.
            </p>
          )}
          {snap.returning && status !== 'finished' && <p className="sim-control__returning">{returnLabel}</p>}
          {status === 'finished' && <p className="sim-control__done">EVA finished.</p>}
        </>
      )}
    </div>
  );
}
