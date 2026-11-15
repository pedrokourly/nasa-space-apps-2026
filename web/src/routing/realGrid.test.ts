/// <reference types="node" />
/**
 * Checks on the REAL Jezero grid in `public/data/` (Data/GIS pipeline, MRO/HiRISE DTM), loaded the
 * same way the Worker does. If Data/GIS regenerates the files and one of these fails, the grid
 * changed in a way routing has to look at before shipping.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { LonLat } from '../lib/mars-geo';
import { isInsideBbox } from '../lib/bbox';
import { parseMeta, parseTargets } from '../lib/loadData';
import { cellIndex, cellToLonLat, isNoData, lonLatToCell, type Grid } from './core/grid';
import { routeBestOrder } from './core/stopOrder';
import { route } from './core/route';
import { O2_RESERVE_FRACTION } from './core/walk';
import { loadGrid } from './loadGrid';

const dataDir = new URL('../../public/data/', import.meta.url);
const diskFetch = async (url: string): Promise<Response> =>
  new Response(readFileSync(new URL(url.slice(url.lastIndexOf('/') + 1), dataDir)));
const readJson = (url: URL): unknown => JSON.parse(readFileSync(url, 'utf8'));

/** Demo stops from the real `targets.geojson` (#28): habitat, every science target, back to the habitat. */
const targets = parseTargets(readJson(new URL('targets.geojson', dataDir))).features;
const HABITAT: LonLat = targets.find((t) => t.properties.id === 'habitat')!.geometry.coordinates;
const DEMO: LonLat[] = [
  HABITAT,
  ...targets.filter((t) => t.properties.id !== 'habitat').map((t) => t.geometry.coordinates),
  HABITAT,
];

let grid: Grid;
beforeAll(async () => {
  grid = await loadGrid('/data/', diskFetch);
});

describe('real Jezero grid (public/data)', () => {
  it('has the mock grid size and a bbox that contains the mock bbox, so mock targets and clicks still line up', () => {
    const real = parseMeta(readJson(new URL('meta.json', dataDir)));
    const mock = parseMeta(readJson(new URL('mock/meta.json', dataDir)));
    expect([real.width, real.height]).toEqual([mock.width, mock.height]);
    expect(isInsideBbox([mock.bbox[0], mock.bbox[1]], real.bbox)).toBe(true);
    expect(isInsideBbox([mock.bbox[2], mock.bbox[3]], real.bbox)).toBe(true);
    expect(real.source).toMatch(/HiRISE/);
  });

  it('elevation has no holes and a plausible range for Jezero (meters)', () => {
    // Count first and assert once: 262,144 expect() calls would make the test slow.
    let holes = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const e of grid.elevation) {
      if (isNoData(grid.meta, e)) holes++;
      else {
        min = Math.min(min, e);
        max = Math.max(max, e);
      }
    }
    expect(holes).toBe(0);
    expect(min).toBeGreaterThan(-2700);
    expect(max).toBeLessThan(-2200);
  });

  it('slope is in degrees (0 to 90), no data only on the 1-cell border, and little of it is impassable', () => {
    const { width: w, height: h } = grid.meta;
    let steep = 0;
    let wrongNoData = 0;
    let outOfRange = 0;
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const s = grid.slope[cellIndex(grid.meta, col, row)]!;
        const border = row === 0 || col === 0 || row === h - 1 || col === w - 1;
        if (isNoData(grid.meta, s) !== border) wrongNoData++;
        if (border) continue;
        if (!(s >= 0 && s <= 90)) outOfRange++;
        if (s >= 25) steep++;
      }
    }
    expect(wrongNoData).toBe(0);
    expect(outOfRange).toBe(0);
    // Measured 0.46% at >= 25° (max 43.7°): a mostly smooth crater floor, as Data/GIS documented.
    expect(steep / (w * h)).toBeLessThan(0.02);
  });

  it('the demo stops sit on valid cells', () => {
    for (const p of DEMO) {
      const c = lonLatToCell(grid.meta, p)!;
      expect(c).not.toBeNull();
      expect(grid.slope[cellIndex(grid.meta, c.col, c.row)]!).toBeLessThan(25);
    }
  });

  it('demo loop (habitat, every target, habitat) is found, GO with the default O₂, in well under 1 s', () => {
    const t0 = performance.now();
    const r = route(grid, DEMO);
    const ms = performance.now() - t0;
    expect(r.properties.verdict).toBe('GO');
    expect(r.properties.point_of_no_return).toBeUndefined();
    expect(r.properties.dist_m).toBeGreaterThan(5_000);
    expect(r.properties.dist_m).toBeLessThan(20_000); // the margin target makes the loop ~16.6 km
    expect(ms).toBeLessThan(1000);
  });

  it('demo loop legs: one per pair of stops, adding up to the totals', () => {
    const p = route(grid, DEMO).properties;
    expect(p.legs).toHaveLength(DEMO.length - 1);
    const sum = (k: 'dist_m' | 'time_s' | 'o2_kg') => p.legs!.reduce((s, l) => s + l[k], 0);
    expect(sum('dist_m')).toBeCloseTo(p.dist_m, 6);
    expect(sum('time_s')).toBeCloseTo(p.time_s, 6);
    expect(sum('o2_kg')).toBeCloseTo(p.o2_kg, 10);
  });

  it('demo loop with too little O₂ is NO-GO and marks a point of no return', () => {
    const total = route(grid, DEMO).properties.o2_kg;
    const r = route(grid, DEMO, { o2_available_kg: total * 0.5 });
    expect(r.properties.verdict).toBe('NO-GO');
    expect(r.properties.point_of_no_return).toBeGreaterThan(0);
  });

  it('a start far from the habitat: the return leads to the habitat, from the last safe vertex when NO-GO (#69)', () => {
    // Start in the north-west, near the upper fan, then visit the delta front: far from the habitat.
    const pts: LonLat[] = [[77.39, 18.475], DEMO[4]!, DEMO[3]!];
    const go = route(grid, pts, { habitat: HABITAT, o2_available_kg: 10 }).properties;
    const habitatCell = lonLatToCell(grid.meta, HABITAT)!;
    const endCell = lonLatToCell(grid.meta, go.return_path!.coordinates.at(-1)!)!;
    expect(endCell).toEqual(habitatCell);
    const need = go.o2_kg + go.return_path!.o2_kg;
    const r = route(grid, pts, { habitat: HABITAT, o2_available_kg: (need * 0.9) / (1 - O2_RESERVE_FRACTION) }); // 90% of the need is usable
    const p = r.properties;
    expect(p.verdict).toBe('NO-GO');
    expect(p.point_of_no_return).toBeGreaterThan(0);
    const stop = Math.max(0, ...(p.legs ?? []).map((l) => l.to_vertex).filter((v) => v < p.point_of_no_return!));
    expect(p.return_path!.from_vertex).toBe(stop);
    expect(p.return_path!.coordinates[0]).toEqual(r.geometry.coordinates[stop]);
    expect(lonLatToCell(grid.meta, p.return_path!.coordinates.at(-1)!)).toEqual(habitatCell);
  });

  it('a stop on the no-data border cell is refused with a clear message', () => {
    const [minLon, minLat, maxLon, maxLat] = grid.meta.bbox;
    const border: LonLat = [minLon + (maxLon - minLon) / grid.meta.width / 2, (minLat + maxLat) / 2];
    expect(() => route(grid, [HABITAT, border])).toThrow(/^Stop 1 is on impassable terrain/);
  });

  it('every real target is reachable from the habitat and back, each on a slope under 25°', () => {
    for (const t of targets.filter((f) => f.properties.id !== 'habitat')) {
      const there = route(grid, [HABITAT, t.geometry.coordinates]).properties;
      const back = route(grid, [t.geometry.coordinates, HABITAT], { habitat: HABITAT }).properties;
      expect(there.dist_m, t.properties.id).toBeGreaterThan(0);
      expect(back.dist_m, t.properties.id).toBeGreaterThan(0);
    }
    for (const t of targets) {
      const c = lonLatToCell(grid.meta, t.geometry.coordinates)!;
      expect(grid.slope[cellIndex(grid.meta, c.col, c.row)]!, t.properties.id).toBeLessThan(25);
    }
  });

  it('best order with 8 stops (every real target plus extra points) takes well under 1 s and never needs more O₂', () => {
    const realStops = DEMO.slice(1, -1);
    const need = 8 - realStops.length;
    const extra: LonLat[] = [];
    for (let row = 120; extra.length < need && row < 400; row += 37) {
      for (let col = 140; extra.length < need && col < 380; col += 61) {
        if (grid.slope[cellIndex(grid.meta, col, row)]! < 10 && (col + row) % 3 === 0) extra.push(cellToLonLat(grid.meta, col, row));
      }
    }
    expect(extra).toHaveLength(need);
    const stops = [...realStops, ...extra];
    expect(stops).toHaveLength(8);
    const t0 = performance.now();
    const best = routeBestOrder(grid, [HABITAT, ...stops]);
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(1000);
    expect(best.properties.stop_order).toHaveLength(9);
    // No return point is added, and the reordered plan never needs more O₂ than the given order.
    const needed = (pts: LonLat[]) => route(grid, [...pts, HABITAT]).properties.o2_kg;
    const reordered = best.properties.stop_order!.map((i) => [HABITAT, ...stops][i]!);
    expect(needed(reordered)).toBeLessThanOrEqual(needed([HABITAT, ...stops]) + 1e-9);
  });

  for (const n of [12, 16, 20]) {
    it(`best order with ${n} stops uses the heuristic, keeps every stop and never needs more O₂`, () => {
      const stops: LonLat[] = [...DEMO.slice(1, -1)];
      for (let row = 60; stops.length < n && row < 470; row += 29) {
        for (let col = 60; stops.length < n && col < 470; col += 43) {
          if (grid.slope[cellIndex(grid.meta, col, row)]! < 10 && (col + row) % 2 === 0) stops.push(cellToLonLat(grid.meta, col, row));
        }
      }
      expect(stops).toHaveLength(n);
      const pts = [HABITAT, ...stops];
      const t0 = performance.now();
      const best = routeBestOrder(grid, pts);
      const ms = performance.now() - t0;
      expect(ms).toBeLessThan(5000); // measured about 0.7 s (12), 1.2 s (16) and 1.6 s (20) in Node
      expect(best.properties.stop_order).toHaveLength(n + 1);
      const needed = (p: LonLat[]) => route(grid, [...p, HABITAT]).properties.o2_kg;
      const reordered = best.properties.stop_order!.map((i) => pts[i]!);
      expect(needed(reordered)).toBeLessThanOrEqual(needed(pts) + 1e-9);
    }, 20_000);
  }

  it('no route cell is impassable', () => {
    const r = route(grid, DEMO);
    for (const [lon, lat] of r.geometry.coordinates) {
      const c = lonLatToCell(grid.meta, [lon, lat])!;
      expect(grid.slope[cellIndex(grid.meta, c.col, c.row)]!).toBeLessThan(25);
    }
  });
});
