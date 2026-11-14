/**
 * Routing core: grid types and cell ↔ lon/lat conversions.
 *
 * Pure logic: no React, no Leaflet, no DOM, no Worker. Runs in the browser,
 * in the Web Worker and in Node (tests). Distances only with `haversine` from `lib/mars-geo.ts`.
 *
 * ASSUMPTIONS (likely format, not yet confirmed by Data/GIS):
 * - `elevation` in meters; `slope` in DEGREES (0 to 90).
 * - Row 0 is the north edge (`meta.row0 === 'north'`), longitude −180 to 180.
 * - Cell values are area samples ("pixel is area"): the center of cell (col, row) sits
 *   half a cell inside the `bbox` edge.
 * - `sand` is optional: 1 = sand, 0 = rock. It only exists if Data/GIS delivers the layer.
 * Only the loader (real-data issue) knows the `.bin` format; everything else uses `Grid`.
 */
import type { LonLat } from '../../lib/mars-geo';
import type { Meta } from '../../types/contract';

/** A loaded grid, ready for routing. Arrays are row-major. */
export interface Grid {
  meta: Meta;
  /** Elevation in meters, `width * height` values. */
  elevation: Float32Array;
  /** Slope in degrees, `width * height` values. */
  slope: Float32Array;
  /** Optional: 1 = sand, 0 = rock. */
  sand?: Uint8Array;
}

/** Position of a cell in the grid: column (x, east) and row (y, southward). */
export interface Cell {
  col: number;
  row: number;
}

/** Creates a `Grid`, checking that each array has the size `meta` implies. */
export function createGrid(grid: Grid): Grid {
  const { width, height } = grid.meta;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`invalid meta: width=${width}, height=${height}`);
  }
  const expected = width * height;
  const check = (name: string, len: number) => {
    if (len !== expected) throw new Error(`${name} has ${len} values; expected ${expected} (${width}×${height})`);
  };
  check('elevation', grid.elevation.length);
  check('slope', grid.slope.length);
  if (grid.sand) check('sand', grid.sand.length);
  return grid;
}

/** Linear index of the cell in the array (row-major). Does not check bounds. */
export function cellIndex(meta: Meta, col: number, row: number): number {
  return row * meta.width + col;
}

/** Tells whether the cell is inside the grid. */
export function inBounds(meta: Meta, col: number, row: number): boolean {
  return Number.isInteger(col) && Number.isInteger(row) && col >= 0 && col < meta.width && row >= 0 && row < meta.height;
}

/** No-data value: `NaN` or equal to the meta `nodata` (compared as Float32). Never treat as zero. */
export function isNoData(meta: Meta, value: number): boolean {
  return Number.isNaN(value) || value === Math.fround(meta.nodata);
}

/** Center of the cell as `[lon, lat]`, longitude −180 to 180. */
export function cellToLonLat(meta: Meta, col: number, row: number): LonLat {
  const [minLon, minLat, maxLon, maxLat] = meta.bbox;
  const lon = minLon + ((col + 0.5) * (maxLon - minLon)) / meta.width;
  const lat = maxLat - ((row + 0.5) * (maxLat - minLat)) / meta.height;
  return [lon, lat];
}

/**
 * Cell that contains the point `[lon, lat]`, or `null` if it is outside the `bbox`.
 * The south/east edge of the `bbox` belongs to the last cell.
 */
export function lonLatToCell(meta: Meta, [lon, lat]: LonLat): Cell | null {
  const [minLon, minLat, maxLon, maxLat] = meta.bbox;
  if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) return null;
  const col = Math.min(meta.width - 1, Math.floor(((lon - minLon) / (maxLon - minLon)) * meta.width));
  const row = Math.min(meta.height - 1, Math.floor(((maxLat - lat) / (maxLat - minLat)) * meta.height));
  return { col, row };
}
