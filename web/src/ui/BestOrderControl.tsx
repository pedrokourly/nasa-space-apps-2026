import { useAppStore } from '../state/store';
import { isExactOrder, MAX_ORDER_STOPS } from '../routing/core/stopOrder';
import { Button } from './kit';
import { SortIcon } from './icons';

/** Notice shown when the best order comes from the heuristic (more than `MAX_ORDER_STOPS` stops). */
export const HEURISTIC_ORDER_NOTICE = `More than ${MAX_ORDER_STOPS} stops: Best order uses a heuristic and does not guarantee the best order.`;

/**
 * "Best order" button (#65): reorders the stops after the start to use the least O₂, counting the way
 * back to the habitat, without adding a return point. Without it, the route follows the click order.
 * Exact up to `MAX_ORDER_STOPS` stops; above that the order is a heuristic and a notice says so.
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
  const exact = isExactOrder(stops);
  const canReorder = stops >= 2 && status !== 'computing';
  const hint = exact
    ? 'Reorder the stops to use the least O₂, counting the way back to the habitat'
    : HEURISTIC_ORDER_NOTICE;

  return (
    <>
      <Button variant="outline" size="sm" disabled={!canReorder} title={hint} onClick={requestBestOrder}>
        <SortIcon />
        Best order
      </Button>
      {!exact && <p className="sim-control__order-note">{HEURISTIC_ORDER_NOTICE}</p>}
    </>
  );
}
