/**
 * Grids inventados para testes do roteamento. NÃO são dados da NASA.
 * Têm o mesmo formato do contrato (`Grid`), então o mesmo código roda no grid real.
 */
import type { Meta } from '../../types/contract';
import { createGrid, type Grid } from './grid';

/** Elevação padrão dos grids mock (m). Valor arbitrário. */
export const MOCK_ELEVATION_M = -2500;
/** Valor de `nodata` usado nos grids mock (mínimo do Float32, como no mock do contrato). */
export const MOCK_NODATA = -3.4028234663852886e38;
/** Declividade (graus) dada a células intransponíveis nos grids mock. Acima do limite de 25°. */
export const MOCK_STEEP_DEG = 40;

const MOCK_R_M = 3389500;
const MOCK_LAT0 = 18;

/** Meta mínimo para um grid mock; `bbox` ilustrativo em Jezero, coerente com células de `cellM` metros. */
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
    fonte: 'MOCK — grid inventado para testes',
  };
}

/** O que uma célula do grid mock contém. `null` = célula sem dado. */
export interface MockCell {
  elev?: number;
  slope?: number;
  sand?: boolean;
}

/** Monta um `Grid` chamando `fn(col, row)` para cada célula. */
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

/** Terreno plano e sem obstáculos. */
export function flatGrid(width: number, height: number, cellM?: number): Grid {
  return buildMockGrid(width, height, () => ({}), { cellM });
}

/** Muro vertical no meio do grid, com uma passagem de uma célula na linha `gapRow`. */
export function wallWithGapGrid(width: number, height: number, gapRow: number): Grid {
  const wallCol = Math.floor(width / 2);
  return buildMockGrid(width, height, (col, row) =>
    col === wallCol && row !== gapRow ? { slope: MOCK_STEEP_DEG } : {},
  );
}

/** Cratera circular intransponível (paredes íngremes) no centro, de raio `radius` células. */
export function craterGrid(width: number, height: number, radius: number): Grid {
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  return buildMockGrid(width, height, (col, row) =>
    Math.hypot(col - cx, row - cy) <= radius ? { slope: MOCK_STEEP_DEG, elev: MOCK_ELEVATION_M - 100 } : {},
  );
}

/** Retângulo de areia `[col0, col1] × [row0, row1]` (inclusivo). */
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

/** Células sem dado nas posições dadas. */
export function holesGrid(width: number, height: number, holes: ReadonlyArray<readonly [col: number, row: number]>): Grid {
  const set = new Set(holes.map(([c, r]) => r * width + c));
  return buildMockGrid(width, height, (col, row) => (set.has(row * width + col) ? null : {}));
}
