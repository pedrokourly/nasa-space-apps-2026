import { useAppStore } from '../state/store'
import { useSimulationStore } from '../state/simulationStore'
import { useActivePlan, useSimulationClock, useSimulationPath, useSimulationSnapshot } from '../routing/useSimulation'
import { SIM_PLAN_LABELS, type SimPlan } from '../routing/simulation'
import { ESTIMATE_LABEL } from '../routing/estimateText'
import { Button, Select } from './kit'
import './SimulationControl.css'

/** EVA plan picker and lifecycle controls, embedded in the route dock. */
export default function SimulationControl() {
  useSimulationClock()
  const hasRoute = useAppStore((state) => state.route !== null && state.route.geometry.coordinates.length >= 2)
  const status = useSimulationStore((state) => state.status)
  const elapsed = useSimulationStore((state) => state.t_s)
  const path = useSimulationPath()
  const snapshot = useSimulationSnapshot()
  const start = useSimulationStore((state) => state.start)
  const pause = useSimulationStore((state) => state.pause)
  const resume = useSimulationStore((state) => state.resume)
  const reset = useSimulationStore((state) => state.reset)
  const setPlan = useSimulationStore((state) => state.setPlan)
  const { plan, plans } = useActivePlan()
  const progress = Math.min(100, (elapsed / Math.max(1, path?.time_s.at(-1) ?? 1)) * 100)

  return (
    <div className="eva-controls" role="group" aria-label="EVA route controls">
      <label className="eva-controls__plan">
        <span className="ui-label">Select route</span>
        <Select aria-label="Select EVA route plan" value={plan} disabled={!hasRoute || plans.length < 2} onChange={(event) => setPlan(event.target.value as SimPlan)}>
          {(plans.length ? plans : ['route' as SimPlan]).map((option) => <option key={option} value={option}>{SIM_PLAN_LABELS[option]}</option>)}
        </Select>
      </label>
      <div className="eva-controls__buttons">
        {(status === 'idle' || status === 'finished') && <Button size="lg" onClick={start} disabled={!hasRoute}>{status === 'finished' ? 'Restart EVA' : 'Start EVA'}</Button>}
        {status === 'running' && <Button variant="secondary" onClick={pause}>Pause</Button>}
        {status === 'paused' && <Button variant="secondary" onClick={resume}>Resume</Button>}
        {status !== 'idle' && <Button variant="outline" onClick={reset}>Reset</Button>}
      </div>
      {status !== 'idle' && <div className="eva-controls__progress" role="progressbar" aria-label="EVA route progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{ width: `${progress}%` }} /></div>}
      {snapshot?.pastPointOfNoReturn && status !== 'idle' && <p className="eva-controls__warning" role="alert">NO-GO: point of no return passed. Remaining O₂ does not cover the return estimate.</p>}
      {status !== 'idle' && <p className="eva-controls__estimate">O₂ and time are estimates: {ESTIMATE_LABEL}.</p>}
    </div>
  )
}
