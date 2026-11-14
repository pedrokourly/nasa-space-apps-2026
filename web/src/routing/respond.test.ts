/// <reference types="node" />
/**
 * Edge cases and the FROZEN response format of the route Worker (S6): one example file per state in
 * `public/data/mock/response-*.json`, generated from the real code over the invented sample terrain.
 * Regenerate with `WRITE_MOCKS=1 npm test -- respond`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LonLat } from '../lib/mars-geo';
import { parseRoute } from '../lib/loadData';
import type { RouteResponse } from './api';
import { BlockedPointError, NoPathError, NO_PATH_MESSAGE, OutOfGridError } from './core/errors';
import { cellToLonLat } from './core/grid';
import { buildMockGrid, flatGrid, holesGrid, MOCK_STEEP_DEG } from './core/mockGrid';
import { createRouter, route } from './core/route';
import { SAMPLE_STOPS, sampleGrid } from './core/sampleRoutes';
import { loadGrid } from './loadGrid';
import { answerRoute, errorFromResponse, routeErrorText } from './respond';

const dir = new URL('../../public/data/mock/', import.meta.url);
const file = (name: string) => new URL(name, dir);
const serialize = (r: unknown) => JSON.stringify(r, null, 2) + '\n';

const grid = sampleGrid();
const router = createRouter(grid);
const HABITAT = SAMPLE_STOPS[0]!;
/** Center of the invented crater: an impassable cell. */
const IN_CRATER: LonLat = [(SAMPLE_STOPS[0]![0] + SAMPLE_STOPS[1]![0]) / 2, (SAMPLE_STOPS[0]![1] + SAMPLE_STOPS[1]![1]) / 2];
const OUTSIDE: LonLat = [77.6, 18.45];
/** A short walk next to the habitat, so the `ok` example stays small. */
const NEAR: LonLat = [HABITAT[0] + 0.0015, HABITAT[1]];

/** The four frozen states, each produced by the real code path. */
async function examples(): Promise<Record<string, RouteResponse>> {
  const gridFails = async (): Promise<never> => {
    await loadGrid('/data/', async () => new Response(null, { status: 404 }));
    throw new Error('unreachable');
  };
  return {
    'response-ok.json': await answerRoute({ id: 1, points: [HABITAT, NEAR] }, router),
    'response-no-path.json': await answerRoute({ id: 2, points: [HABITAT, IN_CRATER] }, router),
    'response-out-of-grid.json': await answerRoute({ id: 3, points: [HABITAT, OUTSIDE] }, router),
    'response-error.json': await answerRoute({ id: 4, points: [HABITAT, NEAR] }, gridFails),
  };
}

describe('frozen RouteResponse states', () => {
  it('ok: carries a route that passes the contract parser', async () => {
    const res = (await examples())['response-ok.json']!;
    expect(Object.keys(res).sort()).toEqual(['id', 'ok', 'route']);
    expect(res.ok).toBe(true);
    if (res.ok) {
      parseRoute(res.route);
      expect(res.route.properties.verdict).toBe('GO');
      expect(res.route.properties.legs).toHaveLength(1);
    }
  });

  it('no-path: a stop on impassable terrain says which stop and what to do', async () => {
    const res = (await examples())['response-no-path.json']!;
    expect(res).toEqual({
      id: 2,
      ok: false,
      reason: 'no-path',
      message: 'Stop 1 is on impassable terrain (too steep or no data). Move it.',
      point_index: 1,
    });
  });

  it('out-of-grid: a point outside the terrain grid says which point', async () => {
    const res = (await examples())['response-out-of-grid.json']!;
    expect(res).toEqual({
      id: 3,
      ok: false,
      reason: 'out-of-grid',
      message: 'Stop 1 is outside the EVA planning area. Move it inside the rectangle.',
      point_index: 1,
    });
  });

  it('error: anything else (here the grid failing to load) keeps its message', async () => {
    const res = (await examples())['response-error.json']!;
    expect(res).toEqual({ id: 4, ok: false, reason: 'error', message: 'Failed to load /data/meta.json (HTTP 404)' });
  });

  it('the example files in public/data/mock are up to date', async () => {
    const all = await examples();
    for (const [name, res] of Object.entries(all)) {
      if (process.env.WRITE_MOCKS) writeFileSync(file(name), serialize(res));
      expect(existsSync(file(name)), `${name} does not exist; generate with WRITE_MOCKS=1 npm test -- respond`).toBe(true);
      expect(JSON.parse(readFileSync(file(name), 'utf8'))).toEqual(JSON.parse(serialize(res)));
    }
  });
});

describe('edge cases never throw past the Worker', () => {
  it('start point on an obstacle: no-path naming the start point', async () => {
    const res = await answerRoute({ id: 1, points: [IN_CRATER, HABITAT] }, router);
    expect(res).toMatchObject({ ok: false, reason: 'no-path', point_index: 0 });
    if (!res.ok) expect(res.message).toMatch(/^The start point is on impassable terrain/);
  });

  it('a no-data cell (like the 1-cell border of the real slope grid) counts as an obstacle', () => {
    const g = holesGrid(9, 9, [[8, 4]]);
    expect(() => route(g, [cellToLonLat(g.meta, 0, 4), cellToLonLat(g.meta, 8, 4)])).toThrow(BlockedPointError);
  });

  it('destination with no path (walled off): the plain no-path message, no point blamed', async () => {
    const g = buildMockGrid(9, 9, (col) => (col === 4 ? { slope: MOCK_STEEP_DEG } : {}));
    const res = await answerRoute({ id: 1, points: [cellToLonLat(g.meta, 0, 4), cellToLonLat(g.meta, 8, 4)] }, createRouter(g));
    expect(res).toEqual({ id: 1, ok: false, reason: 'no-path', message: NO_PATH_MESSAGE });
  });

  it('fewer than 2 points and non-Error throws become state error', async () => {
    expect(await answerRoute({ id: 1, points: [HABITAT] }, router)).toMatchObject({ ok: false, reason: 'error' });
    const res = await answerRoute({ id: 1, points: [] }, () => {
      throw 'boom';
    });
    expect(res).toEqual({ id: 1, ok: false, reason: 'error', message: 'boom' });
  });

  it('every point in the same cell: a valid zero-length route, GO', () => {
    const g = flatGrid(5, 5);
    const p = cellToLonLat(g.meta, 2, 2);
    const r = route(g, [p, p]);
    expect(r.geometry.coordinates).toHaveLength(2);
    expect(r.properties).toMatchObject({ dist_m: 0, time_s: 0, o2_kg: 0, verdict: 'GO' });
    expect(r.properties.profile).toHaveLength(2);
    expect(r.properties.legs).toEqual([{ from_vertex: 0, to_vertex: 1, dist_m: 0, time_s: 0, o2_kg: 0 }]);
    parseRoute(JSON.parse(JSON.stringify(r)));
  });
});

describe('main-thread side', () => {
  it('errorFromResponse rebuilds the right error class with the same message', () => {
    const noPath = errorFromResponse({ id: 1, ok: false, reason: 'no-path', message: 'm1', point_index: 2 });
    expect(noPath).toBeInstanceOf(NoPathError);
    expect((noPath as NoPathError).pointIndex).toBe(2);
    const out = errorFromResponse({ id: 1, ok: false, reason: 'out-of-grid', message: 'm2' });
    expect(out).toBeInstanceOf(OutOfGridError);
    expect(out.message).toBe('m2');
    const other = errorFromResponse({ id: 1, ok: false, reason: 'error', message: 'm3' });
    expect(other).not.toBeInstanceOf(NoPathError);
    expect(other.message).toBe('m3');
  });

  it('routeErrorText: routing failures are shown as is, the rest get the "Route error:" prefix', () => {
    expect(routeErrorText(new BlockedPointError(1))).toMatch(/^Stop 1 is on impassable terrain/);
    expect(routeErrorText(new OutOfGridError(0))).toMatch(/^The start point is outside the EVA planning area/);
    expect(routeErrorText(new NoPathError())).toBe(NO_PATH_MESSAGE);
    expect(routeErrorText(new Error('Failed to load x'))).toBe('Route error: Failed to load x');
    expect(routeErrorText('boom')).toBe('Route error: boom');
  });
});
