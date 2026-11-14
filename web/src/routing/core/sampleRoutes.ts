/**
 * Rotas de exemplo (uma GO, uma NO-GO) calculadas sobre um terreno INVENTADO que usa o mesmo
 * `bbox` do mock do contrato (`public/data/mock/meta.json`) e os alvos de `targets.geojson`.
 * Servem para o Mapa 2D e a UI desenharem o que `route()` devolve. NÃO são dados da NASA.
 * Arquivos gerados: `public/data/mock/route-go.geojson` e `route-no-go.geojson`
 * (regerar com `WRITE_MOCKS=1 npm test -- sampleRoutes`).
 */
import type { LonLat } from '../../lib/mars-geo';
import type { Meta, Route } from '../../types/contract';
import { MOCK_NODATA, buildMockGrid, MOCK_STEEP_DEG } from './mockGrid';
import { lonLatToCell, type Grid } from './grid';
import { route } from './route';

/** Mesmo meta de `public/data/mock/meta.json` (conferido por teste). */
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
  fonte: 'MOCK — grid inventado para rotas de exemplo',
};

/** Paradas do cenário de exemplo: habitat, 3 alvos e volta (coordenadas de `targets.geojson` mock). */
export const SAMPLE_STOPS: LonLat[] = [
  [77.4508, 18.4447], // habitat
  [77.385, 18.455], // frente-delta
  [77.425, 18.47], // margem-carbonatos
  [77.47, 18.42], // terceiro alvo
  [77.4508, 18.4447], // volta ao habitat
];

/** Terreno ondulado e suave, com uma cratera intransponível entre o habitat e o primeiro alvo. */
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

/** O₂ (kg) do cenário NO-GO: pouco demais para a volta pelo mesmo caminho. */
export const SAMPLE_NO_GO_O2_KG = 0.2;

/** Rota GO (O₂ padrão) e NO-GO (pouco O₂), marcadas `mock: true`. */
export function sampleRoutes(): { go: Route; noGo: Route } {
  const grid = sampleGrid();
  const tag = (r: Route): Route => ({ ...r, properties: { ...r.properties, mock: true } });
  return {
    go: tag(route(grid, SAMPLE_STOPS)),
    noGo: tag(route(grid, SAMPLE_STOPS, { o2_disponivel_kg: SAMPLE_NO_GO_O2_KG })),
  };
}
