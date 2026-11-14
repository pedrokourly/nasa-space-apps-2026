/**
 * Errors of the routing core. No dependencies; the Worker turns them into the frozen failure
 * states of `RouteResponse` (`no-path`, `out-of-grid`, `error`) and the UI shows their messages as is.
 */

/** Failure states of a route request. Frozen: add a state only with a contract change. */
export type RouteFailureReason = 'no-path' | 'out-of-grid' | 'error';

/** Default message when no path exists between the points (the UI shows it as is). */
export const NO_PATH_MESSAGE = 'No possible path between the points';

/** How the map labels a requested point: index 0 is the start, the others are numbered stops. */
export function pointLabel(pointIndex: number): string {
  return pointIndex === 0 ? 'The start point' : `Stop ${pointIndex}`;
}

/** No possible path between two points (obstacles, no-data cells or an island). State `no-path`. */
export class NoPathError extends Error {
  /** Index of the requested point that causes the failure, when it is a single point. */
  readonly pointIndex: number | undefined;
  constructor(message = NO_PATH_MESSAGE, pointIndex?: number) {
    super(message);
    this.name = 'NoPathError';
    this.pointIndex = pointIndex;
  }
}

/** A requested point sits on an impassable cell (too steep or no data). A kind of `no-path`. */
export class BlockedPointError extends NoPathError {
  constructor(pointIndex: number, message = `${pointLabel(pointIndex)} is on impassable terrain (too steep or no data). Move it.`) {
    super(message, pointIndex);
    this.name = 'BlockedPointError';
  }
}

/** A requested point is outside the loaded grid (`bbox`). State `out-of-grid`. */
export class OutOfGridError extends Error {
  readonly pointIndex: number | undefined;
  constructor(pointIndex?: number, message = `${pointIndex === undefined ? 'A point' : pointLabel(pointIndex)} is outside the EVA planning area. Move it inside the rectangle.`) {
    super(message);
    this.name = 'OutOfGridError';
    this.pointIndex = pointIndex;
  }
}
