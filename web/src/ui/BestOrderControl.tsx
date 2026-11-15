import { useAppStore } from '../state/store';
import { MAX_ORDER_STOPS } from '../routing/core/stopOrder';

/**
 * "Best order" button (#65): reorders the stops after the start to use the least O₂, counting the way
 * back to the habitat, without adding a return point. Without it, the route follows the click order.
 * The route always uses the balanced cost profile. Rendered inside the EVA block (`SimulationControl`),
 * which gives it its button style.
 */
export default function BestOrderControl() {
  const requestBestOrder = useAppStore((s) => s.requestBestOrder);
  const waypoints = useAppStore((s) => s.waypoints);
  const status = useAppStore((s) => s.routeStatus);

  // Stops = every point after the start, not counting a last point back at the start.
  const last = waypoints[waypoints.length - 1];
  const first = waypoints[0];
  const endsHome = waypoints.length > 2 && !!first && !!last && first[0] === last[0] && first[1] === last[1];
  const stops = Math.max(0, waypoints.length - 1 - (endsHome ? 1 : 0));
  const canReorder = stops >= 2 && stops <= MAX_ORDER_STOPS && status !== 'computing';
  const hint =
    stops > MAX_ORDER_STOPS
      ? `Best order works with up to ${MAX_ORDER_STOPS} stops`
      : 'Reorder the stops to use the least O₂, counting the way back to the habitat';

  return (
    <button type="button" disabled={!canReorder} title={hint} onClick={requestBestOrder}>
      Best order
    </button>
  );
}
