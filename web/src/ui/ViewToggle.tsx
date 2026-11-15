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
      title={to3d ? 'Switch to the 3D view' : 'Switch to the 2D map'}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="M3 7v10l9 5 9-5V7M12 12v10"/></svg>
    </button>
  )
}
