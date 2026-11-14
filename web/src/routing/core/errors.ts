/** Errors of the routing core. No dependencies; the Worker turns them into UI states. */

/** Default message when no path exists between the points (the UI shows it as is). */
export const NO_PATH_MESSAGE = 'No possible path between the points';

/** No possible path between two points (obstacles, no-data cells or an island). */
export class NoPathError extends Error {
  constructor(message = NO_PATH_MESSAGE) {
    super(message);
    this.name = 'NoPathError';
  }
}

/** A requested point is outside the loaded grid (`bbox`). */
export class OutOfGridError extends Error {
  readonly point: [lon: number, lat: number];
  constructor(point: [lon: number, lat: number]) {
    super(`Point outside the grid: [${point[0]}, ${point[1]}]`);
    this.name = 'OutOfGridError';
    this.point = point;
  }
}
