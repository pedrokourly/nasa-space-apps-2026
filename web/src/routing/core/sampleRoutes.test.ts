/// <reference types="node" />
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMeta, parseRoute } from '../../lib/loadData';
import { loadGrid } from '../loadGrid';
import { encodeFloat32LE } from './gridBinary';
import { createRouter } from './route';
import { SAMPLE_META, SAMPLE_STOPS, sampleGrid, sampleRoutes } from './sampleRoutes';

const dir = new URL('../../../public/data/mock/', import.meta.url);
const file = (name: string) => new URL(name, dir);
const serialize = (r: unknown) => JSON.stringify(r, null, 2) + '\n';

const { go, noGo } = sampleRoutes();
const grid = sampleGrid();

if (process.env.WRITE_MOCKS) {
  writeFileSync(file('route-go.geojson'), serialize(go));
  writeFileSync(file('route-no-go.geojson'), serialize(noGo));
  writeFileSync(file('elevation.bin'), encodeFloat32LE(grid.elevation));
  writeFileSync(file('slope.bin'), encodeFloat32LE(grid.slope));
}

/** `fetch` that reads from `public/data/mock/` on disk, to test the Worker loading path in Node. */
const diskFetch = async (url: string): Promise<Response> => {
  const name = url.slice(url.lastIndexOf('/') + 1);
  if (!existsSync(file(name))) return new Response(null, { status: 404 });
  return new Response(readFileSync(file(name)));
};

describe('mock grid files (elevation.bin, slope.bin)', () => {
  it('exist with the size meta.json implies and match the sample terrain', () => {
    for (const [name, values] of [['elevation.bin', grid.elevation], ['slope.bin', grid.slope]] as const) {
      expect(existsSync(file(name)), `${name} does not exist; generate with WRITE_MOCKS=1 npm test -- sampleRoutes`).toBe(true);
      const bytes = readFileSync(file(name));
      expect(bytes.byteLength).toBe(SAMPLE_META.width * SAMPLE_META.height * 4);
      expect(Buffer.compare(bytes, Buffer.from(encodeFloat32LE(values)))).toBe(0);
    }
  });

  it('loading meta.json + .bin the way the Worker does gives the same GO route', async () => {
    const loaded = await loadGrid('/data/mock/', diskFetch);
    const fromFiles = createRouter(loaded)(SAMPLE_STOPS);
    expect(fromFiles.geometry).toEqual(go.geometry);
    expect(fromFiles.properties.verdict).toBe('GO');
    expect(fromFiles.properties.o2_kg).toBeCloseTo(go.properties.o2_kg, 10);
  });

  it('a missing file gives a clear error', async () => {
    await expect(loadGrid('/data/nothing/', async () => new Response(null, { status: 404 }))).rejects.toThrow(/HTTP 404/);
  });
});

describe('sample routes', () => {
  it('the sample terrain uses the same meta as the contract mock', () => {
    const meta = parseMeta(JSON.parse(readFileSync(file('meta.json'), 'utf8')));
    expect({ bbox: SAMPLE_META.bbox, w: SAMPLE_META.width, h: SAMPLE_META.height, mx: SAMPLE_META.m_per_cell_x, my: SAMPLE_META.m_per_cell_y }).toEqual({
      bbox: meta.bbox,
      w: meta.width,
      h: meta.height,
      mx: meta.m_per_cell_x,
      my: meta.m_per_cell_y,
    });
  });

  it('the GO route has verdict GO and the NO-GO route has NO-GO with a point of no return', () => {
    expect(go.properties.verdict).toBe('GO');
    expect(noGo.properties.verdict).toBe('NO-GO');
    const pnr = noGo.properties.point_of_no_return;
    expect(pnr).toBeDefined();
    expect(pnr!).toBeGreaterThan(0);
    expect(pnr!).toBeLessThan(noGo.geometry.coordinates.length);
  });

  it('both routes share the same geometry (only the available O₂ changes)', () => {
    expect(noGo.geometry).toEqual(go.geometry);
    expect(go.properties.dist_m).toBeGreaterThan(5000);
  });

  it('the files in public/data/mock are up to date and pass the contract parser', () => {
    for (const [name, expected] of [['route-go.geojson', go], ['route-no-go.geojson', noGo]] as const) {
      expect(existsSync(file(name)), `${name} does not exist; generate with WRITE_MOCKS=1 npm test -- sampleRoutes`).toBe(true);
      const onDisk = JSON.parse(readFileSync(file(name), 'utf8')) as unknown;
      expect(onDisk).toEqual(JSON.parse(serialize(expected)));
      parseRoute(onDisk);
    }
  });
});
