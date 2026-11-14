import { useState } from 'react'
import { useAppStore } from '../state/store'
import { profilePointAt } from '../routing/profilePoint'
import './RouteSummary.css'

/** A dismissible O₂ warning shown only when the active route is unsafe to complete. */
export default function RouteSummary() {
  const route = useAppStore((state) => state.route)
  const [dismissedRoute, setDismissedRoute] = useState<typeof route>(null)

  if (!route || route.properties.verdict !== 'NO-GO' || dismissedRoute === route) return null

  const turnBackPoint = profilePointAt(route, route.properties.point_of_no_return)
  const turnBackDistance = turnBackPoint ? `${(turnBackPoint.dist_m / 1000).toFixed(2)} km` : null

  return (
    <aside className="route-summary route-summary--alert" role="alert" aria-live="assertive" aria-label="Oxygen return warning">
      <span className="route-summary__alert-icon" aria-hidden="true">!</span>
      <div className="route-summary__alert-copy">
        <strong>NO-GO · Turn back</strong>
        <span>{turnBackDistance ? `Return to the habitat by ${turnBackDistance} along this route.` : 'Return to the habitat now; the route exceeds the available O₂ budget.'}</span>
      </div>
      <button type="button" className="route-summary__dismiss" aria-label="Dismiss O₂ warning" onClick={() => setDismissedRoute(route)}>×</button>
    </aside>
  )
}
