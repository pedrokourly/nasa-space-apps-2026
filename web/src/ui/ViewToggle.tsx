import { Button } from './kit'
import { CubeIcon, MapIcon } from './icons'
import './ViewToggle.css'

export type ViewMode = '2d' | '3d'

interface Props {
  view: ViewMode
  onChange: (v: ViewMode) => void
}

/**
 * Header button that swaps the 2D map for the 3D view and back. The icon shows what a press does:
 * a cube (go to 3D) on the 2D map, a flat map (go back to 2D) in the 3D view.
 */
export default function ViewToggle({ view, onChange }: Props) {
  const to3d = view === '2d'
  const label = to3d ? 'Switch to the 3D view' : 'Switch to the 2D map'
  return (
    <Button variant="secondary" size="icon" className="view-toggle" onClick={() => onChange(to3d ? '3d' : '2d')} aria-label={label} title={label}>
      {to3d ? <CubeIcon /> : <MapIcon />}
    </Button>
  )
}
