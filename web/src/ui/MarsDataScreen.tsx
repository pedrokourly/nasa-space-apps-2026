import { useState } from 'react'
import type { AppData } from '../lib/loadData'
import type { Conditions, ConditionStats, ConditionVariable, SolConditions } from '../types/contract'
import { LAYERS } from '../map/layers'

type Props = { data: AppData | null; error: string | null; conditions: Conditions | null }

/** Display unit for air temperature. The MEDA data (`conditions.json`, `unit`) is in kelvin. */
type TempUnit = 'C' | 'K' | 'F'
const TEMP_UNITS: TempUnit[] = ['C', 'K', 'F']
const TEMP_UNIT_LABEL: Record<TempUnit, string> = { C: '°C', K: 'K', F: '°F' }

function stats(value: ConditionVariable): ConditionStats | null {
  return value.status === 'ok' ? value : null
}

/**
 * `value` with `digits` decimals, halves rounded away from zero (736.05 → "736.1", −59.05 → "−59.1").
 * Plain `toFixed` gives "736.0" because 736.05 is stored as 736.04999…; the 12-digit precision step
 * removes that floating-point noise first.
 */
function fixed(value: number, digits: number): string {
  const scale = 10 ** digits
  const scaled = Number((Math.abs(value) * scale).toPrecision(12))
  return (Math.sign(value) * Math.round(scaled) / scale).toFixed(digits)
}

/** One decimal, with a real minus sign. */
function num(value: number): string {
  return fixed(value, 1).replace('-', '−')
}

/** Kelvin converted to the chosen unit, with its symbol. */
function inUnit(kelvin: number, unit: TempUnit): string {
  if (unit === 'K') return `${num(kelvin)} K`
  if (unit === 'C') return `${num(kelvin - 273.15)} °C`
  return `${num(kelvin * 9 / 5 - 459.67)} °F`
}

/** Temperature in the chosen unit, followed by the source value in kelvin, e.g. "−59.1 °C (214.1 K)". */
function temperatureText(kelvin: number, unit: TempUnit): string {
  return unit === 'K' ? inUnit(kelvin, 'K') : `${inUnit(kelvin, unit)} (${num(kelvin)} K)`
}

function TempUnitControl({ unit, onChange }: { unit: TempUnit; onChange: (unit: TempUnit) => void }) {
  return <div className="mars-data-units" role="group" aria-label="Temperature unit">
    {TEMP_UNITS.map((u) => <button type="button" key={u} aria-pressed={unit === u} onClick={() => onChange(u)}>{TEMP_UNIT_LABEL[u]}</button>)}
  </div>
}

/** Wind or dust: its values when the file has them, otherwise "unavailable" with the reason from the file. */
function OptionalVariable({ label, value }: { label: string; value: ConditionVariable | undefined }) {
  if (!value) return null
  if (value.status === 'ok') {
    return <p className="mars-data-note"><strong>{label}:</strong> mean {fixed(value.mean, 1)} {value.unit} ({fixed(value.min, 1)}–{fixed(value.max, 1)} {value.unit})</p>
  }
  return <p className="mars-data-note"><strong>{label}: unavailable.</strong> {value.reason}</p>
}

function dateRange(sol: SolConditions): string {
  const format = (value: string) => new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(value))
  return `${format(sol.utc_start)} – ${format(sol.utc_end)} UTC`
}

function Metric({ label, value, range }: { label: string; value: string; range?: string }) {
  return <div className="mars-data-metric"><span>{label}</span><strong>{value}</strong>{range && <small>{range}</small>}</div>
}

export default function MarsDataScreen({ data, error, conditions }: Props) {
  const latest = conditions?.sols.find((sol) => sol.sol === conditions.latest_sol) ?? conditions?.sols[0]
  const temperature = latest ? stats(latest.variables.air_temperature) : null
  const pressure = latest ? stats(latest.variables.pressure) : null
  const humidity = latest ? stats(latest.variables.relative_humidity) : null
  const [unit, setUnit] = useState<TempUnit>('C')

  return <section className="mars-data-screen" aria-label="Mars conditions dashboard">
    <div className="mars-data-screen__title">
      <div><span className="tool-panel__eyebrow">LATEST AVAILABLE · NOT LIVE</span><h1>Conditions for Jezero</h1><p>Measurements and mapped products available in the project data files.</p></div>
      <span className="data-status-pill">{error ? 'MAP DATA ERROR' : data ? 'DATA LOADED' : 'LOADING'}</span>
    </div>

    <div className="mars-data-grid">
      <article className="mars-data-card">
        <div className="mars-data-card__header"><span aria-hidden="true">◷</span><h2>MEDA observations · Sol {latest?.sol ?? '—'}</h2>{temperature && <TempUnitControl unit={unit} onChange={setUnit} />}</div>
        {latest ? <>
          <div className="mars-data-metrics">
            {temperature && <Metric label="Air temperature · mean" value={temperatureText(temperature.mean, unit)} range={unit === 'K' ? `${num(temperature.min)}–${num(temperature.max)} K` : `${inUnit(temperature.min, unit)} to ${inUnit(temperature.max, unit)} · ${num(temperature.min)}–${num(temperature.max)} K`} />}
            {pressure && <Metric label="Surface pressure · mean" value={`${fixed(pressure.mean, 1)} Pa`} range={`${fixed(pressure.min, 1)}–${fixed(pressure.max, 1)} Pa`} />}
            {humidity && <Metric label="Relative humidity · mean" value={`${fixed(humidity.mean, 2)}%`} range={`${fixed(humidity.min, 2)}–${fixed(humidity.max, 2)}%`} />}
          </div>
          <p className="mars-data-note">Observation window: {dateRange(latest)}.</p>
          <OptionalVariable label="Wind" value={latest.variables.wind} />
          <OptionalVariable label="Dust" value={latest.variables.dust} />
          <footer><a href={conditions?.source.url} target="_blank" rel="noreferrer">{conditions?.source.instrument} · {conditions?.source.mission}</a> · Sol {latest.sol} · PDS release {conditions?.source.release} · DOI {conditions?.source.doi}</footer>
        </> : <p className="mars-data-note">MEDA conditions data is unavailable.</p>}
      </article>

      <article className="mars-data-card">
        <div className="mars-data-card__header"><span aria-hidden="true">⌁</span><h2>Terrain model</h2></div>
        {data ? <>
          <div className="mars-data-metrics">
            <Metric label="Grid" value={`${data.meta.width} × ${data.meta.height} cells`} />
            <Metric label="Cell spacing · east-west" value={`${data.meta.m_per_cell_x.toFixed(2)} m`} />
            <Metric label="Cell spacing · north-south" value={`${data.meta.m_per_cell_y.toFixed(2)} m`} />
            <Metric label="Raster products" value="Elevation · slope" />
          </div>
          <p className="mars-data-note">Elevation and slope grids are available as Float32 little-endian files. Slope is in degrees.</p>
          <footer>{data.meta.source}</footer>
        </> : <p className="mars-data-note">Terrain metadata is loading.</p>}
      </article>

      <article className="mars-data-card mars-data-card--wide">
        <div className="mars-data-card__header"><span aria-hidden="true">◴</span><h2>Recent MEDA sols</h2></div>
        {conditions?.sols.length ? <div className="mars-data-table-wrap"><table className="mars-data-table">
          <thead><tr><th>Sol · UTC window</th><th>Air temperature · mean</th><th>Pressure · mean</th><th>Humidity · mean</th></tr></thead>
          <tbody>{conditions.sols.map((sol) => {
            const temp = stats(sol.variables.air_temperature)
            const press = stats(sol.variables.pressure)
            const rh = stats(sol.variables.relative_humidity)
            return <tr key={sol.sol}><td><strong>{sol.sol}</strong><small>{dateRange(sol)}</small></td><td>{temp ? temperatureText(temp.mean, unit) : '—'}</td><td>{press ? `${fixed(press.mean, 1)} Pa` : '—'}</td><td>{rh ? `${fixed(rh.mean, 2)}%` : '—'}</td></tr>
          })}</tbody>
        </table><footer><a href={conditions.source.url} target="_blank" rel="noreferrer">{conditions.source.instrument} · {conditions.source.mission}</a> · {conditions.source.release} · DOI {conditions.source.doi}</footer></div> : <p className="mars-data-note">No MEDA sol records are available.</p>}
      </article>

      <article className="mars-data-card mars-data-card--wide">
        <div className="mars-data-card__header"><span aria-hidden="true">◇</span><h2>Science targets</h2><span className="mars-data-count">{data?.targets.features.length ?? 0} mapped</span></div>
        <div className="mars-data-targets">{data?.targets.features.map((target) => {
          const mission = data.missions.find((item) => item.id === target.properties.mission)
          return <div className="mars-data-target" key={target.properties.id}>
            <div><strong>{target.properties.name}</strong><p>{target.properties.why}</p></div>
            {mission && <a href={mission.link} target="_blank" rel="noreferrer">{mission.instrument} · {mission.name}</a>}
          </div>
        })}</div>
        <footer>Target catalog: <code>targets.geojson</code>. Each target is linked to its source mission.</footer>
      </article>

      <article className="mars-data-card mars-data-card--wide">
        <div className="mars-data-card__header"><span aria-hidden="true">▱</span><h2>Available map layers</h2></div>
        <div className="mars-data-missions">{LAYERS.map((layer) => {
          const mission = data?.missions.find((item) => item.id === layer.missionId)
          return <a href={layer.sourceUrl} target="_blank" rel="noreferrer" key={layer.id}>
            <strong>{layer.name}</strong><span>{mission ? `${mission.instrument} · ${mission.name}` : layer.shortLabel}{layer.resolution ? ` · ${layer.resolution}` : ''}</span>
            <p>{layer.product}{layer.versionOrDate ? ` · ${layer.versionOrDate}` : ''}</p>
          </a>
        })}</div>
        <footer>Layer products available in the map. Dates and resolutions are shown only when present in product metadata.</footer>
      </article>
    </div>
  </section>
}
