/**
 * Invented grids for routing tests. NOT NASA data.
 * They have the same format as the contract (`Grid`), so the same code runs on the real grid.
 */
import type { Meta } from '../../types/contract';
import { createGrid, type Grid } from './grid';

/** Default elevation of mock grids (m). Arbitrary value. */
export const MOCK_ELEVATION_M = -2500;
/** `nodata` value used in mock grids (Float32 minimum, as in the contract mock). */
export const MOCK_NODATA = -3.4028234663852886e38;
/** Slope (degrees) given to impassable cells in mock grids. Above the 25° limit. */
export const MOCK_STEEP_DEG = 40;

const MOCK_R_M = 3389500;
const MOCK_LAT0 = 18;

/** Minimal meta for a mock grid; illustrative `bbox` in Jezero, consistent with `cellM`-meter cells. */
export function mockMeta(width: number, height: number, cellM = 20): Meta {
  const dLat = (cellM / MOCK_R_M) * (180 / Math.PI);
  const dLon = dLat / Math.cos((MOCK_LAT0 * Math.PI) / 180);
  return {
    bbox: [77, MOCK_LAT0, 77 + width * dLon, MOCK_LAT0 + height * dLat],
    width,
    height,
    m_per_cell_x: cellM,
    m_per_cell_y: cellM,
    lon_convention: '-180..180',
    nodata: MOCK_NODATA,
    crs: 'EPSG:4326',
    row0: 'north',
    dtype: 'float32le',
    source: 'MOCK: invented grid for tests',
  };
}

/** What a mock grid cell holds. `null` = no-data cell. */
export interface MockCell {
  elev?: number;
  slope?: number;
  sand?: boolean;
}

/** Builds a `Grid` by calling `fn(col, row)` for every cell. */
export function buildMockGrid(
  width: number,
  height: number,
  fn: (col: number, row: number) => MockCell | null,
  opts: { cellM?: number; withSand?: boolean; meta?: Meta } = {},
): Grid {
  const n = width * height;
  const elevation = new Float32Array(n);
  const slope = new Float32Array(n);
  const sand = opts.withSand ? new Uint8Array(n) : undefined;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = row * width + col;
      const c = fn(col, row);
      if (c === null) {
        elevation[i] = MOCK_NODATA;
        slope[i] = MOCK_NODATA;
      } else {
        elevation[i] = c.elev ?? MOCK_ELEVATION_M;
        slope[i] = c.slope ?? 0;
        if (sand && c.sand) sand[i] = 1;
      }
    }
  }
  return createGrid({ meta: opts.meta ?? mockMeta(width, height, opts.cellM), elevation, slope, ...(sand ? { sand } : {}) });
}

/** Flat terrain with no obstacles. */
export function flatGrid(width: number, height: number, cellM?: number): Grid {
  return buildMockGrid(width, height, () => ({}), { cellM });
}

/** Vertical wall in the middle of the grid, with a one-cell gap at row `gapRow`. */
export function wallWithGapGrid(width: number, height: number, gapRow: number): Grid {
  const wallCol = Math.floor(width / 2);
  return buildMockGrid(width, height, (col, row) =>
    col === wallCol && row !== gapRow ? { slope: MOCK_STEEP_DEG } : {},
  );
}

/** Impassable circular crater (steep walls) at the center, with a radius of `radius` cells. */
export function craterGrid(width: number, height: number, radius: number): Grid {
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  return buildMockGrid(width, height, (col, row) =>
    Math.hypot(col - cx, row - cy) <= radius ? { slope: MOCK_STEEP_DEG, elev: MOCK_ELEVATION_M - 100 } : {},
  );
}

/** Sand rectangle `[col0, col1] × [row0, row1]` (inclusive). */
export function sandPatchGrid(
  width: number,
  height: number,
  patch: { col0: number; col1: number; row0: number; row1: number },
): Grid {
  return buildMockGrid(
    width,
    height,
    (col, row) =>
      col >= patch.col0 && col <= patch.col1 && row >= patch.row0 && row <= patch.row1 ? { sand: true } : {},
    { withSand: true },
  );
}

/** No-data cells at the given positions. */
export function holesGrid(width: number, height: number, holes: ReadonlyArray<readonly [col: number, row: number]>): Grid {
  const set = new Set(holes.map(([c, r]) => r * width + c));
  return buildMockGrid(width, height, (col, row) => (set.has(row * width + col) ? null : {}));
}
