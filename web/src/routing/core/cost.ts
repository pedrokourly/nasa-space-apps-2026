/**
 * Função de custo por célula (grid de custo). A decisão de pesos é do Roteamento:
 * modos de rota diferentes são só outro `CostProfile`, sem mexer nos arquivos de dados.
 */
import { isNoData, type Grid } from './grid';

/**
 * Pesos do modelo de custo.
 * Invariante (para o A* ser ótimo): `sandMultiplier >= 1` e `slopeWeight >= 0`,
 * ou seja, nenhuma célula custa menos que andar em terreno plano.
 */
export interface CostProfile {
  /** Declividade (graus) a partir da qual a célula é intransponível. */
  maxSlopeDeg: number;
  /** Multiplicador do custo em areia. */
  sandMultiplier: number;
  /** Peso do termo de declividade: fator = 1 + slopeWeight * (slope / maxSlopeDeg)². */
  slopeWeight: number;
}

/**
 * Perfil padrão. SUPOSIÇÃO de projeto (plano inicial do time): >= 25° intransponível e
 * areia custa 2×. `slopeWeight` é hipótese nossa, sem referência científica; calibrar com a
 * rota real (dados reais) e registrar no README.
 */
export const DEFAULT_PROFILE: CostProfile = {
  maxSlopeDeg: 25,
  sandMultiplier: 2,
  slopeWeight: 2,
};

/** Custo de uma célula "bloqueada" (intransponível ou sem dado). */
export const BLOCKED = Infinity;

/** Valida o perfil; lança se violar a invariante. */
export function assertProfile(p: CostProfile): void {
  if (!(p.maxSlopeDeg > 0)) throw new Error('maxSlopeDeg deve ser > 0');
  if (!(p.sandMultiplier >= 1)) throw new Error('sandMultiplier deve ser >= 1');
  if (!(p.slopeWeight >= 0)) throw new Error('slopeWeight deve ser >= 0');
}

/**
 * Fator de custo da célula `i` (>= 1), ou `BLOCKED`.
 * Bloqueada se: sem dado em elevação ou declividade, ou declividade >= `maxSlopeDeg`.
 * Célula sem dado nunca vira zero nem "plano".
 */
export function cellFactor(grid: Grid, i: number, profile: CostProfile): number {
  const { meta } = grid;
  const elev = grid.elevation[i]!;
  const slope = grid.slope[i]!;
  if (isNoData(meta, elev) || isNoData(meta, slope)) return BLOCKED;
  if (slope >= profile.maxSlopeDeg) return BLOCKED;
  const ratio = Math.max(0, slope) / profile.maxSlopeDeg;
  let factor = 1 + profile.slopeWeight * ratio * ratio;
  if (grid.sand && grid.sand[i] === 1) factor *= profile.sandMultiplier;
  return factor;
}

/** Fator de custo de todas as células, em ordem row-major. `Infinity` = bloqueada. */
export function buildCostGrid(grid: Grid, profile: CostProfile = DEFAULT_PROFILE): Float32Array {
  assertProfile(profile);
  const n = grid.meta.width * grid.meta.height;
  const costs = new Float32Array(n);
  for (let i = 0; i < n; i++) costs[i] = cellFactor(grid, i, profile);
  return costs;
}
