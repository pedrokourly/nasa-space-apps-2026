/**
 * Sample routes (one GO, one NO-GO) computed over an INVENTED terrain that uses the same
 * `bbox` as the contract mock (`public/data/mock/meta.json`) and the stops of the mock targets.
 * They let the 2D map and the UI draw what `route()` returns. NOT NASA data.
 * Generated files: `public/data/mock/route-go.geojson` and `route-no-go.geojson`
 * (regenerate with `WRITE_MOCKS=1 npm test -- sampleRoutes`).
 */
import type { LonLat } from '../../lib/mars-geo';
import type { Meta, Route } from '../../types/contract';
import { MOCK_NODATA, buildMockGrid, MOCK_STEEP_DEG } from './mockGrid';
import { lonLatToCell, type Grid } from './grid';
import { route } from './route';

/** Same meta as `public/data/mock/meta.json` (checked by a test). */
export const SAMPLE_META: Meta = {
  bbox: [77.36, 18.4, 77.5, 18.5],
  width: 512,
  height: 512,
  m_per_cell_x: 15.345,
  m_per_cell_y: 11.554,
  lon_convention: '-180..180',
  nodata: MOCK_NODATA,
  crs: 'EPSG:4326',
  row0: 'north',
  dtype: 'float32le',
  source: 'MOCK: invented grid for sample routes',
};

/** Stops of the sample scenario: habitat, 3 targets and back (coordinates from the mock `targets.geojson`). */
export const SAMPLE_STOPS: LonLat[] = [
  [77.4508, 18.4447], // habitat
  [77.385, 18.455], // frente-delta
  [77.425, 18.47], // margem-carbonatos
  [77.47, 18.42], // third target
  [77.4508, 18.4447], // back to the habitat
];

/** Smooth rolling terrain with an impassable crater between the habitat and the first target. */
export function sampleGrid(): Grid {
  const { width: w, height: h } = SAMPLE_META;
  const elevAt = (col: number, row: number): number =>
    -2500 + 12 * Math.sin(col / 35) + 8 * Math.cos(row / 45);
  const mid = lonLatToCell(SAMPLE_META, [(SAMPLE_STOPS[0]![0] + SAMPLE_STOPS[1]![0]) / 2, (SAMPLE_STOPS[0]![1] + SAMPLE_STOPS[1]![1]) / 2])!;
  const R = 30;
  return buildMockGrid(
    w,
    h,
    (col, row) => {
      if (Math.hypot(col - mid.col, row - mid.row) <= R) return { elev: -2600, slope: MOCK_STEEP_DEG };
      const dzdx = (elevAt(col + 1, row) - elevAt(col - 1, row)) / (2 * SAMPLE_META.m_per_cell_x);
      const dzdy = (elevAt(col, row + 1) - elevAt(col, row - 1)) / (2 * SAMPLE_META.m_per_cell_y);
      return { elev: elevAt(col, row), slope: (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI };
    },
    { meta: SAMPLE_META },
  );
}

/** O₂ (kg) of the NO-GO scenario: too little for the return along the same path. */
export const SAMPLE_NO_GO_O2_KG = 0.2;

/** GO route (default O₂) and NO-GO route (little O₂), flagged `mock: true`. */
export function sampleRoutes(): { go: Route; noGo: Route } {
  const grid = sampleGrid();
  const tag = (r: Route): Route => ({ ...r, properties: { ...r.properties, mock: true } });
  return {
    go: tag(route(grid, SAMPLE_STOPS)),
    noGo: tag(route(grid, SAMPLE_STOPS, { o2_available_kg: SAMPLE_NO_GO_O2_KG })),
  };
}
