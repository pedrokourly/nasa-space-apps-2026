import { describe, expect, it } from 'vitest';
import { cellIndex, cellToLonLat } from './grid';
import { buildMockGrid, flatGrid, MOCK_STEEP_DEG } from './mockGrid';
import { returnCostField } from './returnField';
import { route } from './route';

const pt = (g: ReturnType<typeof flatGrid>, col: number, row: number) => cellToLonLat(g.meta, col, row);

describe('returnCostField (optimal return)', () => {
  it('is 0 at the habitat and grows with distance on flat ground', () => {
    const g = flatGrid(21, 21, 20);
    const f = returnCostField(g, { col: 10, row: 10 });
    expect(f[cellIndex(g.meta, 10, 10)]).toBe(0);
    expect(f[cellIndex(g.meta, 15, 10)]!).toBeGreaterThan(f[cellIndex(g.meta, 12, 10)]!);
  });

  it('on flat ground equals the O₂ of the straight route from that cell to the habitat', () => {
    const g = flatGrid(30, 5, 20);
    const f = returnCostField(g, { col: 0, row: 2 });
    const direct = route(g, [pt(g, 0, 2), pt(g, 25, 2)]).properties.o2_kg;
    expect(f[cellIndex(g.meta, 25, 2)]!).toBeCloseTo(direct, 10);
  });

  it('blocked cells and cells cut off from the habitat are Infinity', () => {
    const g = buildMockGrid(9, 5, (col) => (col === 4 ? { slope: MOCK_STEEP_DEG } : {}));
    const f = returnCostField(g, { col: 0, row: 2 });
    expect(f[cellIndex(g.meta, 4, 2)]).toBe(Infinity);
    expect(f[cellIndex(g.meta, 8, 2)]).toBe(Infinity);
    expect(Number.isFinite(f[cellIndex(g.meta, 3, 2)]!)).toBe(true);
  });

  it('going home downhill costs less than coming up from home', () => {
    // Elevation drops toward the east: the habitat (west) is high.
    const g = buildMockGrid(20, 3, (col) => ({ elev: -2500 - col * 2, slope: 5.7 }));
    const f = returnCostField(g, { col: 0, row: 1 });
    const out = route(g, [pt(g, 0, 1), pt(g, 15, 1)]).properties.o2_kg; // downhill, away from home
    expect(f[cellIndex(g.meta, 15, 1)]!).toBeGreaterThan(out); // coming back is uphill
  });
});
