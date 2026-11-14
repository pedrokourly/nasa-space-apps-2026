import './ViewToggle.css'

export type ViewMode = '2d' | '3d'

interface Props {
  view: ViewMode
  onChange: (v: ViewMode) => void
}

/** Header button that swaps the 2D map for the 3D view and back. */
export default function ViewToggle({ view, onChange }: Props) {
  const to3d = view === '2d'
  return (
    <button
      type="button"
      className="view-toggle"
      onClick={() => onChange(to3d ? '3d' : '2d')}
      aria-label={to3d ? 'Switch to the 3D view' : 'Switch to the 2D map'}
    >
      {to3d ? '3D view' : '2D map'}
    </button>
  )
}
