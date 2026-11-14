import { describe, expect, it } from 'vitest';
import { NoPathError, OutOfGridError } from './errors';
import { cellToLonLat } from './grid';
import { buildMockGrid, flatGrid, wallWithGapGrid, mockMeta } from './mockGrid';
import { createRouter, route } from './route';
import { DEFAULT_WALK, segmentCost, walkingSpeed } from './walk';

const cellPt = (g: ReturnType<typeof flatGrid>, col: number, row: number) => cellToLonLat(g.meta, col, row);

describe('modelo de caminhada', () => {
  it('no plano vale a velocidade base; subir é mais lento que plano', () => {
    expect(walkingSpeed(0)).toBeCloseTo(DEFAULT_WALK.speedFlatMS, 10);
    expect(walkingSpeed(0.3)).toBeLessThan(walkingSpeed(0));
    expect(walkingSpeed(-0.05)).toBeGreaterThan(walkingSpeed(0)); // pico de Tobler: leve descida
  });

  it('subir gasta mais O₂ que andar o mesmo trecho no plano', () => {
    const flat = segmentCost(100, 0);
    const up = segmentCost(100, 20);
    expect(up.time_s).toBeGreaterThan(flat.time_s);
    expect(up.o2_kg).toBeGreaterThan(flat.o2_kg);
  });

  it('distância zero não gasta nada', () => {
    expect(segmentCost(0, 5)).toEqual({ time_s: 0, o2_kg: 0 });
  });
});

describe('route(): métricas', () => {
  it('devolve Feature LineString com dist_m, tempo_s, o2_kg e perfil coerente', () => {
    const g = flatGrid(40, 10, 20);
    const r = route(g, [cellPt(g, 0, 5), cellPt(g, 30, 5)]);
    expect(r.type).toBe('Feature');
    expect(r.geometry.type).toBe('LineString');
    const { dist_m, tempo_s, o2_kg, perfil } = r.properties;
    expect(dist_m).toBeGreaterThan(0);
    expect(tempo_s).toBeGreaterThan(0);
    expect(o2_kg).toBeGreaterThan(0);
    expect(perfil).toHaveLength(r.geometry.coordinates.length);
    expect(perfil[0]![0]).toBe(0);
    expect(perfil[perfil.length - 1]![0]).toBeCloseTo(dist_m, 6);
    for (const [lon] of r.geometry.coordinates) {
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
    }
  });

  it('grid plano: dobrar a distância dobra o tempo e o O₂', () => {
    const g = flatGrid(60, 5, 20);
    const a = route(g, [cellPt(g, 0, 2), cellPt(g, 10, 2)]).properties;
    const b = route(g, [cellPt(g, 0, 2), cellPt(g, 20, 2)]).properties;
    expect(b.dist_m / a.dist_m).toBeCloseTo(2, 6);
    expect(b.tempo_s / a.tempo_s).toBeCloseTo(2, 6);
    expect(b.o2_kg / a.o2_kg).toBeCloseTo(2, 6);
  });

  it('subida é mais lenta e gasta mais O₂ que o plano', () => {
    const ramp = buildMockGrid(40, 5, (col) => ({ elev: -2500 + col * 0.5, slope: 1.43 }));
    const flat = flatGrid(40, 5, 20);
    const up = route(ramp, [cellPt(ramp, 0, 2), cellPt(ramp, 30, 2)]).properties;
    const level = route(flat, [cellPt(flat, 0, 2), cellPt(flat, 30, 2)]).properties;
    expect(up.tempo_s).toBeGreaterThan(level.tempo_s);
    expect(up.o2_kg).toBeGreaterThan(level.o2_kg);
  });

  it('createRouter fixa o grid e as opções', () => {
    const g = flatGrid(20, 5, 20);
    const fn = createRouter(g, { o2_disponivel_kg: 123 });
    const pts = [cellPt(g, 0, 2), cellPt(g, 10, 2)];
    expect(fn(pts)).toEqual(route(g, pts, { o2_disponivel_kg: 123 }));
  });
});

describe('route(): veredito e ponto de não retorno', () => {
  const g = flatGrid(40, 5, 20);
  const A = cellPt(g, 0, 2);
  const B = cellPt(g, 20, 2);
  const total = route(g, [A, B]).properties.o2_kg; // só a ida, 20 passos iguais
  const step = total / 20;

  it('ida sem volta: precisa de ida e volta; 1,5× o O₂ da ida é NO-GO', () => {
    expect(route(g, [A, B], { o2_disponivel_kg: total * 1.5 }).properties.veredito).toBe('NO-GO');
    expect(route(g, [A, B], { o2_disponivel_kg: total * 2.01 }).properties.veredito).toBe('GO');
  });

  it('ida e volta ao início (circuito): basta o O₂ do trajeto todo', () => {
    const loop = route(g, [A, B, A]).properties;
    expect(loop.o2_kg).toBeCloseTo(2 * total, 8);
    expect(route(g, [A, B, A], { o2_disponivel_kg: loop.o2_kg * 1.01 }).properties.veredito).toBe('GO');
    expect(route(g, [A, B, A], { o2_disponivel_kg: loop.o2_kg * 0.99 }).properties.veredito).toBe('NO-GO');
  });

  it('ponto de não retorno: primeiro vértice onde ida + volta passa do disponível', () => {
    // No plano, ida + volta no vértice i = 2·i·step; com 4,5·step disponíveis, passa em i = 3.
    const r = route(g, [A, B], { o2_disponivel_kg: 4.5 * step });
    expect(r.properties.veredito).toBe('NO-GO');
    expect(r.properties.ponto_nao_retorno).toBe(3);
  });

  it('com O₂ de sobra não há ponto de não retorno', () => {
    const r = route(g, [A, B], { o2_disponivel_kg: 100 });
    expect(r.properties.veredito).toBe('GO');
    expect(r.properties.ponto_nao_retorno).toBeUndefined();
  });
});

describe('route(): erros', () => {
  it('menos de 2 pontos', () => {
    const g = flatGrid(5, 5);
    expect(() => route(g, [cellPt(g, 0, 0)])).toThrow(/2 pontos/);
  });

  it('ponto fora do grid lança OutOfGridError', () => {
    const g = flatGrid(5, 5);
    expect(() => route(g, [cellPt(g, 0, 0), [0, 0]])).toThrow(OutOfGridError);
  });

  it('sem caminho lança NoPathError', () => {
    const g = buildMockGrid(9, 9, (col) => (col === 4 ? { slope: 40 } : {}));
    expect(() => route(g, [cellPt(g, 0, 4), cellPt(g, 8, 4)])).toThrow(NoPathError);
  });

  it('passa pela passagem do muro e todos os vértices ficam em células livres', () => {
    const g = wallWithGapGrid(21, 21, 3);
    const r = route(g, [cellPt(g, 0, 18), cellPt(g, 20, 18)]);
    expect(r.geometry.coordinates.length).toBeGreaterThan(20);
    expect(r.properties.veredito).toBeDefined();
  });

  it('mockMeta é coerente: lado da célula em metros bate com o bbox', () => {
    const m = mockMeta(100, 100, 20);
    const dLat = (m.bbox[3] - m.bbox[1]) / m.height;
    expect((dLat * Math.PI) / 180 * 3389500).toBeCloseTo(20, 6);
  });
});
