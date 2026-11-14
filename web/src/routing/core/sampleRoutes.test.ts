/// <reference types="node" />
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMeta, parseRoute } from '../../lib/loadData';
import { SAMPLE_META, sampleRoutes } from './sampleRoutes';

const dir = new URL('../../../public/data/mock/', import.meta.url);
const file = (name: string) => new URL(name, dir);
const serialize = (r: unknown) => JSON.stringify(r, null, 2) + '\n';

const { go, noGo } = sampleRoutes();

if (process.env.WRITE_MOCKS) {
  writeFileSync(file('route-go.geojson'), serialize(go));
  writeFileSync(file('route-no-go.geojson'), serialize(noGo));
}

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
