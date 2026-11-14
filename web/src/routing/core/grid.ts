/**
 * Núcleo do roteamento: tipos do grid e conversões célula ↔ lon/lat.
 *
 * Lógica pura: sem React, sem Leaflet, sem DOM, sem Worker. Roda no navegador,
 * no Web Worker e no Node (testes). Distância só com `haversine` de `lib/mars-geo.ts`.
 *
 * PREMISSAS (formato provável, ainda não confirmado pelo Dados/GIS):
 * - `elevation` em metros; `slope` em GRAUS (0 a 90).
 * - Linha 0 é a borda norte (`meta.row0 === 'north'`), longitude −180 a 180.
 * - Os valores de célula são amostras de área ("pixel is area"): o centro da célula
 *   (col, row) fica em meia célula para dentro da borda do `bbox`.
 * - `sand` é opcional: 1 = areia, 0 = rocha. Só existe se o Dados/GIS entregar a camada.
 * Só o loader (issue de dados reais) conhece o formato dos `.bin`; o resto usa `Grid`.
 */
import type { LonLat } from '../../lib/mars-geo';
import type { Meta } from '../../types/contract';

/** Grid já carregado, pronto para o roteamento. Matrizes em ordem de linha (row-major). */
export interface Grid {
  meta: Meta;
  /** Elevação em metros, `width * height` valores. */
  elevation: Float32Array;
  /** Declividade em graus, `width * height` valores. */
  slope: Float32Array;
  /** Opcional: 1 = areia, 0 = rocha. */
  sand?: Uint8Array;
}

/** Posição de uma célula no grid: coluna (x, leste) e linha (y, para o sul). */
export interface Cell {
  col: number;
  row: number;
}

/** Cria um `Grid` validando que o tamanho de cada matriz bate com `meta`. */
export function createGrid(grid: Grid): Grid {
  const { width, height } = grid.meta;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`meta inválido: width=${width}, height=${height}`);
  }
  const expected = width * height;
  const check = (nome: string, len: number) => {
    if (len !== expected) throw new Error(`${nome} tem ${len} valores; esperado ${expected} (${width}×${height})`);
  };
  check('elevation', grid.elevation.length);
  check('slope', grid.slope.length);
  if (grid.sand) check('sand', grid.sand.length);
  return grid;
}

/** Índice linear da célula na matriz (row-major). Não valida limites. */
export function cellIndex(meta: Meta, col: number, row: number): number {
  return row * meta.width + col;
}

/** Diz se a célula está dentro do grid. */
export function inBounds(meta: Meta, col: number, row: number): boolean {
  return Number.isInteger(col) && Number.isInteger(row) && col >= 0 && col < meta.width && row >= 0 && row < meta.height;
}

/** Valor sem dado: `NaN` ou igual ao `nodata` do meta (comparado em Float32). Nunca tratar como zero. */
export function isNoData(meta: Meta, value: number): boolean {
  return Number.isNaN(value) || value === Math.fround(meta.nodata);
}

/** Centro da célula em `[lon, lat]`, com longitude −180 a 180. */
export function cellToLonLat(meta: Meta, col: number, row: number): LonLat {
  const [minLon, minLat, maxLon, maxLat] = meta.bbox;
  const lon = minLon + ((col + 0.5) * (maxLon - minLon)) / meta.width;
  const lat = maxLat - ((row + 0.5) * (maxLat - minLat)) / meta.height;
  return [lon, lat];
}

/**
 * Célula que contém o ponto `[lon, lat]`, ou `null` se estiver fora do `bbox`.
 * A borda sul/leste do `bbox` pertence à última célula.
 */
export function lonLatToCell(meta: Meta, [lon, lat]: LonLat): Cell | null {
  const [minLon, minLat, maxLon, maxLat] = meta.bbox;
  if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) return null;
  const col = Math.min(meta.width - 1, Math.floor(((lon - minLon) / (maxLon - minLon)) * meta.width));
  const row = Math.min(meta.height - 1, Math.floor(((maxLat - lat) / (maxLat - minLat)) * meta.height));
  return { col, row };
}
