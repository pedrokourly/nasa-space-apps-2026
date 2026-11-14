import './DataStatus.css'

/** Centered overlay shown while the data loads, or when loading failed. */
export default function DataStatus({ loading, error }: { loading: boolean; error: string | null }) {
  if (!loading && !error) return null
  return (
    <div className="data-status" role="status">
      {error ? (
        <>
          <span>Could not load Jezero data: {error}</span>
          <button type="button" onClick={() => location.reload()}>
            Reload
          </button>
        </>
      ) : (
        <span>Loading Jezero data…</span>
      )}
    </div>
  )
}
