import { describe, expect, it } from 'vitest';
import { cellIndex, cellToLonLat, lonLatToCell } from './grid';
import { buildMockGrid, flatGrid, MOCK_STEEP_DEG, wallWithGapGrid } from './mockGrid';
import { returnCostField, traceReturnPath } from './returnField';
import { createRouter, route } from './route';

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

describe('return_path (traced optimal way home)', () => {
  const habitatCell = { col: 0, row: 2 };

  it('ends at the habitat and its O₂ matches the return field at the last point within 1%', () => {
    const g = buildMockGrid(30, 5, (col) => ({ elev: -2500 - col * 1.5, slope: 4 }));
    const r = route(g, [pt(g, 0, 2), pt(g, 12, 2), pt(g, 25, 3)]);
    const ret = r.properties.return_path!;
    expect(ret).toBeDefined();
    const habitat = cellToLonLat(g.meta, habitatCell.col, habitatCell.row);
    expect(ret.coordinates[ret.coordinates.length - 1]).toEqual(habitat);
    expect(ret.coordinates[0]).toEqual(r.geometry.coordinates[r.geometry.coordinates.length - 1]);
    const field = returnCostField(g, habitatCell);
    const last = lonLatToCell(g.meta, r.geometry.coordinates[r.geometry.coordinates.length - 1]!)!;
    const expected = field[cellIndex(g.meta, last.col, last.row)]!;
    expect(Math.abs(ret.o2_kg - expected) / expected).toBeLessThan(0.01);
    expect(ret.dist_m).toBeGreaterThan(0);
    expect(ret.time_s).toBeGreaterThan(0);
  });

  it('goes around an obstacle instead of crossing blocked cells', () => {
    const g = wallWithGapGrid(15, 9, 7);
    const r = route(g, [pt(g, 1, 1), pt(g, 13, 1)]);
    const ret = r.properties.return_path!;
    expect(ret).toBeDefined();
    const rows = ret.coordinates.map((c) => lonLatToCell(g.meta, c)!);
    for (const cell of rows) {
      expect(g.slope[cellIndex(g.meta, cell.col, cell.row)]!).toBeLessThan(MOCK_STEEP_DEG);
    }
    expect(rows.some((c) => c.col === 7 && c.row === 7)).toBe(true); // through the gap
  });

  it('is absent on a loop that ends at the habitat', () => {
    const g = flatGrid(30, 5, 20);
    const r = route(g, [pt(g, 0, 2), pt(g, 15, 2), pt(g, 0, 2)]);
    expect(r.properties.return_path).toBeUndefined();
  });

  it('is absent when every point falls in the habitat cell', () => {
    const g = flatGrid(30, 5, 20);
    const r = route(g, [pt(g, 0, 2), pt(g, 0, 2)]);
    expect(r.properties.return_path).toBeUndefined();
  });

  it('returns null (no crash) when there is no way home', () => {
    const g = buildMockGrid(9, 5, (col) => (col === 4 ? { slope: MOCK_STEEP_DEG } : {}));
    const field = returnCostField(g, habitatCell);
    expect(traceReturnPath(g, field, { col: 8, row: 2 })).toBeNull();
    expect(traceReturnPath(g, field, { col: 4, row: 2 })).toBeNull(); // blocked cell
    const ok = traceReturnPath(g, field, { col: 3, row: 2 });
    expect(ok?.cells[ok.cells.length - 1]).toEqual(habitatCell);
  });

  it('follows the EVA params: a heavier load costs more O₂ on the way home', () => {
    const g = flatGrid(40, 5, 20);
    const pts = [pt(g, 0, 2), pt(g, 30, 2)];
    const base = createRouter(g)(pts).properties.return_path!;
    const heavy = createRouter(g)(pts, { loadMassKg: 140 }).properties.return_path!;
    expect(heavy.o2_kg).toBeGreaterThan(base.o2_kg);
  });
});
