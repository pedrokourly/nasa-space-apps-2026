/**
 * `route()`: liga os pontos pedidos com A* sobre o grid e calcula distância, tempo, O₂,
 * perfil de elevação, ponto de não retorno e veredito GO / NO-GO. Lógica pura.
 *
 * Convenções:
 * - Os vértices da linha são centros de célula (o ponto pedido é "encaixado" na célula).
 * - Distâncias com `haversine` (R = 3389,5 km), como manda o contrato.
 * - Retorno: nesta versão a volta é pelo mesmo caminho. O retorno ótimo é do S5.
 */
import { haversine, type LonLat } from '../../lib/mars-geo';
import type { Route } from '../../types/contract';
import { findPath } from './astar';
import { DEFAULT_PROFILE, type CostProfile } from './cost';
import { NoPathError, OutOfGridError } from './errors';
import { cellIndex, cellToLonLat, lonLatToCell, type Cell, type Grid } from './grid';
import { DEFAULT_O2_AVAILABLE_KG, DEFAULT_WALK, segmentCost, type WalkProfile } from './walk';

export interface RouteOptions {
  cost?: CostProfile;
  walk?: WalkProfile;
  /** O₂ disponível na saída (kg). Padrão: `DEFAULT_O2_AVAILABLE_KG` (suposição). */
  o2_disponivel_kg?: number;
}

/**
 * Rota que passa por todos os `points`, na ordem.
 * Lança `OutOfGridError` (ponto fora do grid), `NoPathError` (sem caminho) ou `Error` (menos de 2 pontos).
 *
 * Veredito: GO se o O₂ do trajeto, mais o da volta pelo mesmo caminho quando o último ponto não é
 * o primeiro, cabe no disponível. `ponto_nao_retorno` é o primeiro vértice em que o O₂ já gasto
 * somado ao da volta por onde veio passa do disponível (ausente se isso nunca acontece).
 */
export function route(grid: Grid, points: LonLat[], options: RouteOptions = {}): Route {
  if (points.length < 2) throw new Error('route precisa de pelo menos 2 pontos');
  const costProfile = options.cost ?? DEFAULT_PROFILE;
  const walk = options.walk ?? DEFAULT_WALK;
  const available = options.o2_disponivel_kg ?? DEFAULT_O2_AVAILABLE_KG;
  const { meta } = grid;

  const stops: Cell[] = points.map((p) => {
    const cell = lonLatToCell(meta, p);
    if (!cell) throw new OutOfGridError(p);
    return cell;
  });

  const path: Cell[] = [];
  for (let i = 1; i < stops.length; i++) {
    const leg = findPath(grid, stops[i - 1]!, stops[i]!, costProfile);
    if (!leg) throw new NoPathError();
    path.push(...(i === 1 ? leg.cells : leg.cells.slice(1)));
  }

  const coords: LonLat[] = path.map((c) => cellToLonLat(meta, c.col, c.row));
  const elev = path.map((c) => grid.elevation[cellIndex(meta, c.col, c.row)]!);

  const perfil: [number, number][] = [[0, elev[0]!]];
  // fwd[i] / back[i]: O₂ acumulado indo até o vértice i / voltando do vértice i até o início.
  const fwd: number[] = [0];
  const back: number[] = [0];
  let dist = 0;
  let time = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = haversine(coords[i - 1]!, coords[i]!);
    const dz = elev[i]! - elev[i - 1]!;
    const go = segmentCost(d, dz, walk);
    const ret = segmentCost(d, -dz, walk);
    dist += d;
    time += go.time_s;
    fwd.push(fwd[i - 1]! + go.o2_kg);
    back.push(back[i - 1]! + ret.o2_kg);
    perfil.push([dist, elev[i]!]);
  }

  const last = coords.length - 1;
  const first = stops[0]!;
  const end = stops[stops.length - 1]!;
  const isLoop = first.col === end.col && first.row === end.row;
  const needed = fwd[last]! + (isLoop ? 0 : back[last]!);

  let pnr: number | undefined;
  for (let i = 0; i <= last; i++) {
    if (fwd[i]! + back[i]! > available) {
      pnr = i;
      break;
    }
  }

  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: {
      dist_m: dist,
      tempo_s: time,
      o2_kg: fwd[last]!,
      perfil,
      veredito: needed <= available ? 'GO' : 'NO-GO',
      ...(pnr !== undefined ? { ponto_nao_retorno: pnr } : {}),
    },
  };
}

/** Fixa o grid e as opções: devolve a função `(pontos) => Route`, como o Worker espera (`RouteFn`). */
export function createRouter(grid: Grid, options: RouteOptions = {}): (points: LonLat[]) => Route {
  return (points) => route(grid, points, options);
}
