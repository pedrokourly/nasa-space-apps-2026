import { describe, expect, it } from 'vitest';
import { findPath, findPathDijkstra } from './astar';
import { buildCostGrid, DEFAULT_PROFILE, cellFactor } from './cost';
import {
  buildMockGrid,
  craterGrid,
  flatGrid,
  holesGrid,
  MOCK_STEEP_DEG,
  sandPatchGrid,
  wallWithGapGrid,
} from './mockGrid';

/** PRNG determinístico (mulberry32) para testes reproduzíveis. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('função de custo', () => {
  it('declividade >= 25° bloqueia; abaixo custa mais que plano', () => {
    const g = buildMockGrid(3, 1, (col) => ({ slope: [0, 24.9, 25][col]! }));
    expect(cellFactor(g, 0, DEFAULT_PROFILE)).toBe(1);
    const f = cellFactor(g, 1, DEFAULT_PROFILE);
    expect(f).toBeGreaterThan(1);
    expect(Number.isFinite(f)).toBe(true);
    expect(cellFactor(g, 2, DEFAULT_PROFILE)).toBe(Infinity);
  });

  it('célula sem dado bloqueia (nunca vira zero)', () => {
    const g = holesGrid(3, 1, [[1, 0]]);
    const costs = buildCostGrid(g);
    expect(costs[1]).toBe(Infinity);
    expect(costs[0]).toBe(1);
  });

  it('areia custa 2× o mesmo terreno sem areia', () => {
    const g = sandPatchGrid(2, 1, { col0: 1, col1: 1, row0: 0, row1: 0 });
    expect(cellFactor(g, 1, DEFAULT_PROFILE)).toBeCloseTo(2 * cellFactor(g, 0, DEFAULT_PROFILE), 10);
  });

  it('rejeita perfil que daria custo menor que o plano', () => {
    expect(() => buildCostGrid(flatGrid(2, 2), { ...DEFAULT_PROFILE, sandMultiplier: 0.5 })).toThrow();
  });
});

describe('A* em terrenos de teste', () => {
  it('grid plano: linha reta tem o comprimento esperado', () => {
    const g = flatGrid(11, 11, 20);
    const r = findPath(g, { col: 0, row: 5 }, { col: 10, row: 5 })!;
    expect(r.cells).toHaveLength(11);
    expect(r.length_m).toBeCloseTo(200, 6);
    expect(r.cost).toBeCloseTo(200, 6);
  });

  it('muro com passagem: o caminho cruza o muro só pela passagem', () => {
    const g = wallWithGapGrid(21, 21, 3);
    const r = findPath(g, { col: 0, row: 18 }, { col: 20, row: 18 })!;
    expect(r).not.toBeNull();
    const crossings = r.cells.filter((c) => c.col === 10);
    expect(crossings).toEqual([{ col: 10, row: 3 }]);
  });

  it('muro sem passagem: não há caminho', () => {
    const g = buildMockGrid(9, 9, (col) => (col === 4 ? { slope: MOCK_STEEP_DEG } : {}));
    expect(findPath(g, { col: 0, row: 4 }, { col: 8, row: 4 })).toBeNull();
  });

  it('não corta a quina na diagonal entre dois obstáculos', () => {
    // Obstáculos em (1,0) e (0,1): ir de (0,0) a (1,1) na diagonal passaria pela quina.
    const g = buildMockGrid(3, 3, (col, row) => ((col === 1 && row === 0) || (col === 0 && row === 1) ? { slope: 40 } : {}));
    expect(findPath(g, { col: 0, row: 0 }, { col: 1, row: 1 })).toBeNull();
  });

  it('cratera: contorna sem pisar nela e custa mais que a linha reta', () => {
    const g = craterGrid(31, 31, 8);
    const r = findPath(g, { col: 0, row: 15 }, { col: 30, row: 15 })!;
    for (const c of r.cells) {
      expect(Math.hypot(c.col - 15, c.row - 15)).toBeGreaterThan(8);
    }
    expect(r.length_m).toBeGreaterThan(30 * 20);
  });

  it('areia: contorna um pequeno retângulo de areia quando o desvio é barato', () => {
    const g = sandPatchGrid(21, 21, { col0: 9, col1: 11, row0: 9, row1: 11 });
    const r = findPath(g, { col: 0, row: 10 }, { col: 20, row: 10 })!;
    const sand = g.sand!;
    expect(r.cells.some((c) => sand[c.row * 21 + c.col] === 1)).toBe(false);
  });

  it('areia: atravessa quando não há como contornar', () => {
    const g = sandPatchGrid(7, 1, { col0: 3, col1: 3, row0: 0, row1: 0 });
    const r = findPath(g, { col: 0, row: 0 }, { col: 6, row: 0 })!;
    expect(r.cells).toHaveLength(7);
    expect(r.cost).toBeGreaterThan(r.length_m);
  });

  it('buraco (sem dado) no caminho: desvia; início, destino ou ilha bloqueados: null', () => {
    const g = holesGrid(9, 9, [[4, 4]]);
    const r = findPath(g, { col: 0, row: 4 }, { col: 8, row: 4 })!;
    expect(r.cells.some((c) => c.col === 4 && c.row === 4)).toBe(false);

    expect(findPath(g, { col: 4, row: 4 }, { col: 8, row: 4 })).toBeNull();
    expect(findPath(g, { col: 0, row: 4 }, { col: 4, row: 4 })).toBeNull();

    const ring = holesGrid(5, 5, [[1, 1], [2, 1], [3, 1], [1, 2], [3, 2], [1, 3], [2, 3], [3, 3]]);
    expect(findPath(ring, { col: 0, row: 0 }, { col: 2, row: 2 })).toBeNull();
  });

  it('início igual ao destino: caminho de uma célula e custo 0', () => {
    const r = findPath(flatGrid(3, 3), { col: 1, row: 1 }, { col: 1, row: 1 })!;
    expect(r.cells).toEqual([{ col: 1, row: 1 }]);
    expect(r.cost).toBe(0);
  });

  it('fora do grid lança RangeError', () => {
    expect(() => findPath(flatGrid(3, 3), { col: -1, row: 0 }, { col: 1, row: 1 })).toThrow(RangeError);
  });

  it('células retangulares: usa m_per_cell_x e m_per_cell_y distintos', () => {
    const g = flatGrid(3, 3);
    g.meta.m_per_cell_x = 10;
    g.meta.m_per_cell_y = 30;
    const horiz = findPath(g, { col: 0, row: 0 }, { col: 2, row: 0 })!;
    const vert = findPath(g, { col: 0, row: 0 }, { col: 0, row: 2 })!;
    expect(horiz.length_m).toBeCloseTo(20, 6);
    expect(vert.length_m).toBeCloseTo(60, 6);
  });
});

describe('A* confere com Dijkstra', () => {
  it('mesmo custo em 40 grids aleatórios com declive, areia e buracos', () => {
    const rand = rng(2026);
    let comparados = 0;
    for (let n = 0; n < 40; n++) {
      const w = 20 + Math.floor(rand() * 10);
      const h = 20 + Math.floor(rand() * 10);
      const g = buildMockGrid(
        w,
        h,
        () => {
          const r = rand();
          if (r < 0.04) return null;
          return { slope: rand() * 30, sand: rand() < 0.2 };
        },
        { withSand: true, cellM: 10 + rand() * 20 },
      );
      const start = { col: Math.floor(rand() * w), row: Math.floor(rand() * h) };
      const goal = { col: Math.floor(rand() * w), row: Math.floor(rand() * h) };
      const a = findPath(g, start, goal);
      const d = findPathDijkstra(g, start, goal);
      if (d === null) {
        expect(a).toBeNull();
      } else {
        expect(a).not.toBeNull();
        expect(a!.cost).toBeCloseTo(d.cost, 6);
        comparados++;
      }
    }
    expect(comparados).toBeGreaterThan(10);
  });
});

describe('desempenho em 512 × 512', () => {
  const LIMIT_MS = 1000;

  it('grid plano, canto a canto, em menos de 1 s', () => {
    const g = flatGrid(512, 512, 20);
    const t0 = performance.now();
    const r = findPath(g, { col: 0, row: 0 }, { col: 511, row: 511 });
    const ms = performance.now() - t0;
    expect(r).not.toBeNull();
    expect(ms).toBeLessThan(LIMIT_MS);
  });

  it('grid com declive, areia e 8% de obstáculos aleatórios, em menos de 1 s', () => {
    const rand = rng(7);
    const g = buildMockGrid(
      512,
      512,
      (col, row) => {
        if ((col === 0 && row === 0) || (col === 511 && row === 511)) return {}; // início e destino livres
        return rand() < 0.08 ? { slope: MOCK_STEEP_DEG } : { slope: rand() * 20, sand: rand() < 0.2 };
      },
      { withSand: true },
    );
    const t0 = performance.now();
    const r = findPath(g, { col: 0, row: 0 }, { col: 511, row: 511 });
    const ms = performance.now() - t0;
    // Com 8% de obstáculos espalhados (seed fixa) existe caminho; o teste exige achá-lo.
    expect(r).not.toBeNull();
    expect(ms).toBeLessThan(LIMIT_MS);
  });
});
