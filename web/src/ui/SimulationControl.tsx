import { useEffect, useRef } from 'react';
import { ESTIMATE_LABEL } from '../routing/estimateText';
import L from 'leaflet';
import { useAppStore } from '../state/store';
import { useSimulationStore } from '../state/simulationStore';
import { useSimulationClock, useSimulationSnapshot } from '../routing/useSimulation';
import { formatDistance, formatElapsed } from './simulationFormat';
import './SimulationControl.css';

/**
 * Minimal EVA simulation control (issue #62): Start EVA / Pause / Resume / Reset and a readout of
 * elapsed time, distance and O₂ left. Final styling belongs to the UI workstream.
 * O₂ timing is an approximation derived from the routing walk model (assumption).
 */
export default function SimulationControl() {
  useSimulationClock();
  const hasRoute = useAppStore((s) => s.route !== null && s.route.geometry.coordinates.length >= 2);
  const status = useSimulationStore((s) => s.status);
  const start = useSimulationStore((s) => s.start);
  const pause = useSimulationStore((s) => s.pause);
  const resume = useSimulationStore((s) => s.resume);
  const reset = useSimulationStore((s) => s.reset);
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

  return (
    <div ref={rootRef} className="sim-control" role="group" aria-label="EVA simulation">
      <div className="sim-control__buttons">
        {(status === 'idle' || status === 'finished') && (
          <button type="button" onClick={start} disabled={!hasRoute}>
            {status === 'finished' ? 'Restart EVA' : 'Start EVA'}
          </button>
        )}
        {status === 'running' && (
          <button type="button" onClick={pause}>
            Pause
          </button>
        )}
        {status === 'paused' && (
          <button type="button" onClick={resume}>
            Resume
          </button>
        )}
        <button type="button" onClick={reset} disabled={status === 'idle'}>
          Reset
        </button>
      </div>
      {!hasRoute && <p className="sim-control__hint">Compute a route to simulate the EVA.</p>}
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
          {snap.pastPointOfNoReturn && (
            <p className="sim-control__warning" role="alert">
              NO-GO: point of no return passed. The remaining O₂ no longer covers the way back.
            </p>
          )}
          <p className="sim-control__estimate">O₂ and time: {ESTIMATE_LABEL}.</p>
          {status === 'finished' && <p className="sim-control__done">EVA finished.</p>}
        </>
      )}
    </div>
  );
}
