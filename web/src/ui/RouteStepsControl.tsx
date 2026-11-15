import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { useAppStore } from '../state/store'
import { Button } from './kit'
import { ListIcon } from './icons'
import './RouteStepsControl.css'

/** Select and remove individual route vertices, or clear the complete route. */
export default function RouteStepsControl() {
  const root = useRef<HTMLDivElement>(null)
  const waypoints = useAppStore((state) => state.waypoints)
  const setWaypoints = useAppStore((state) => state.setWaypoints)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<number[]>([])

  useEffect(() => {
    if (!root.current) return
    L.DomEvent.disableClickPropagation(root.current)
    L.DomEvent.disableScrollPropagation(root.current)
  }, [])

  // When the number of points changes, drop selections past the end and close on an empty route.
  // Adjusting state during render (instead of in an effect) avoids an extra render pass.
  const [prevCount, setPrevCount] = useState(waypoints.length)
  if (prevCount !== waypoints.length) {
    setPrevCount(waypoints.length)
    setSelected((current) => current.filter((index) => index < waypoints.length))
    if (waypoints.length === 0) setOpen(false)
  }

  if (waypoints.length === 0) return null
  const toggleStep = (index: number) => setSelected((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])
  const removeSelected = () => {
    const remaining = waypoints.filter((_, index) => !selected.includes(index))
    setWaypoints(remaining.length < 2 ? [] : remaining)
    setSelected([])
  }

  return (
    <div className="route-steps" ref={root}>
      <Button variant="outline" size="sm" className="route-steps__trigger" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <ListIcon />
        Manage steps
      </Button>
      {open && <section className="route-steps__popover" aria-label="Manage route steps">
        <header><strong>Route steps</strong><button type="button" onClick={() => { setWaypoints([]); setSelected([]) }}>Remove all</button></header>
        <ul>{waypoints.map(([lon, lat], index) => <li key={`${index}-${lon}-${lat}`}>
          <label><input type="checkbox" checked={selected.includes(index)} onChange={() => toggleStep(index)} /><span>{index === 0 ? 'A · Start' : `Step ${index}`}</span></label>
          <small>{lat.toFixed(3)}° {lat < 0 ? 'S' : 'N'} · {Math.abs(lon).toFixed(3)}° {lon < 0 ? 'W' : 'E'}</small>
        </li>)}</ul>
        <footer><span>{selected.length} selected</span><button type="button" disabled={selected.length === 0} onClick={removeSelected}>Remove selected</button></footer>
      </section>}
    </div>
  )
}
