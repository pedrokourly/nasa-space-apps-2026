/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { crismProvenanceParts, loadCrism } from './crism';
import { parseCrism, parseMeta } from './loadData';
import { getLayer } from '../map/layers';

const mockDir = new URL('../../public/data/mock/', import.meta.url);
const dataDir = new URL('../../public/data/', import.meta.url);
const readJson = (dir: URL, f: string): unknown => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));

/** A valid `crism.json`, as Data/GIS would write it. */
const valid = () => ({
  bbox: [77.28, 18.36, 77.56, 18.64],
  product_id: 'FRT00005C5E_07_BRCARJ_MTR3',
  acquired: '2007-05-19',
  mineral: 'Carbonate',
  legend: {
    title: 'CAR browse product',
    entries: [
      { color: '#ffffff', label: 'Carbonate' },
      { color: '#f0f', label: 'Fe/Mg phyllosilicate' },
    ],
  },
});

describe('parseCrism', () => {
  it('accepts a valid file and the mock file', () => {
    expect(parseCrism(valid()).product_id).toBe('FRT00005C5E_07_BRCARJ_MTR3');
    expect(parseCrism(readJson(mockDir, 'crism.json')).mock).toBe(true);
  });

  it('rejects anything that is not an object', () => {
    for (const bad of [null, [], 'x', 3]) expect(() => parseCrism(bad)).toThrow(/crism\.json/);
  });

  it('rejects a bad bbox', () => {
    const cases: unknown[] = [
      [1, 2, 3],
      [77.3, 18.4, 77.5, 'x'],
      [77.5, 18.4, 77.3, 18.5], // min > max
      [77.3, 18.5, 77.5, 18.4],
      [250, 18.4, 260, 18.5], // 0–360 longitude, not allowed in the contract
      [77.3, 91, 77.5, 92],
    ];
    for (const bbox of cases) expect(() => parseCrism({ ...valid(), bbox }), JSON.stringify(bbox)).toThrow();
  });

  it('requires product_id, mineral and a real ISO acquisition date', () => {
    expect(() => parseCrism({ ...valid(), product_id: '' })).toThrow(/product_id/);
    expect(() => parseCrism({ ...valid(), mineral: undefined })).toThrow(/mineral/);
    for (const acquired of ['19/05/2007', '2007-5-19', '2007-02-30', 20070519, undefined]) {
      expect(() => parseCrism({ ...valid(), acquired }), String(acquired)).toThrow(/acquired/);
    }
  });

  it('requires a legend with a title and hex-colored labeled entries', () => {
    expect(() => parseCrism({ ...valid(), legend: undefined })).toThrow(/legend/);
    expect(() => parseCrism({ ...valid(), legend: { title: 'x', entries: [] } })).toThrow(/entries/);
    expect(() => parseCrism({ ...valid(), legend: { title: '', entries: [{ color: '#fff', label: 'a' }] } })).toThrow(
      /title/,
    );
    expect(() => parseCrism({ ...valid(), legend: { title: 'x', entries: [{ color: 'red', label: 'a' }] } })).toThrow(
      /color/,
    );
    expect(() => parseCrism({ ...valid(), legend: { title: 'x', entries: [{ color: '#fff', label: '' }] } })).toThrow(
      /label/,
    );
  });

  it('only accepts a boolean mock flag', () => {
    expect(() => parseCrism({ ...valid(), mock: 'yes' })).toThrow(/mock/);
    expect(parseCrism({ ...valid(), mock: true }).mock).toBe(true);
  });
});

describe('mock files', () => {
  const crism = parseCrism(readJson(mockDir, 'crism.json'));
  const meta = parseMeta(readJson(dataDir, 'meta.json'));
  const png = readFileSync(new URL('crism.png', mockDir));

  it('is flagged as mock and sits inside the Jezero grid', () => {
    expect(crism.product_id).toBe('MOCK');
    const [minLon, minLat, maxLon, maxLat] = crism.bbox;
    expect(minLon).toBeGreaterThanOrEqual(meta.bbox[0]);
    expect(minLat).toBeGreaterThanOrEqual(meta.bbox[1]);
    expect(maxLon).toBeLessThanOrEqual(meta.bbox[2]);
    expect(maxLat).toBeLessThanOrEqual(meta.bbox[3]);
  });

  it('crism.png is an RGBA PNG', () => {
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect(png[24]).toBe(8); // bit depth
    expect(png[25]).toBe(6); // color type 6 = RGBA
    expect(png.readUInt32BE(16)).toBeGreaterThan(0);
    expect(png.readUInt32BE(20)).toBeGreaterThan(0);
  });

  it('the layer registry has the crism overlay, off by default, pointing at MRO / CRISM', () => {
    const def = getLayer('crism');
    expect(def).toMatchObject({ kind: 'crism', type: 'overlay', missionId: 'mro-crism', defaultOpacity: 0.7 });
  });
});

/** A fake `fetch` over a map of url → response (or an error status). Unknown urls are 404. */
function fakeFetch(files: Record<string, { body?: unknown; type?: string; status?: number }>) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const f = files[url];
    if (!f) return new Response('not found', { status: 404 });
    const headers = { 'content-type': f.type ?? 'application/json' };
    if (init?.method === 'HEAD') return new Response(null, { status: f.status ?? 200, headers });
    const body = typeof f.body === 'string' ? f.body : JSON.stringify(f.body);
    return new Response(body, { status: f.status ?? 200, headers });
  });
}

const mockJson = readJson(mockDir, 'crism.json');
const base = '/';

describe('loadCrism fallback', () => {
  it('uses the real files when both exist', async () => {
    const fetchImpl = fakeFetch({
      '/data/crism.json': { body: valid() },
      '/data/crism.png': { type: 'image/png' },
      '/data/mock/crism.json': { body: mockJson },
    });
    const got = await loadCrism({ fetchImpl, base });
    expect(got.source).toBe('real');
    expect(got.imageUrl).toBe('/data/crism.png');
    expect(got.meta.mock).toBeUndefined();
    expect(got.meta.product_id).toBe('FRT00005C5E_07_BRCARJ_MTR3');
  });

  it('falls back to the mock when the real JSON is a 404', async () => {
    const fetchImpl = fakeFetch({ '/data/mock/crism.json': { body: mockJson } });
    const got = await loadCrism({ fetchImpl, base });
    expect(got).toMatchObject({ source: 'mock', imageUrl: '/data/mock/crism.png' });
    expect(got.meta.mock).toBe(true);
  });

  it('falls back when a SPA host answers the missing JSON with index.html (200)', async () => {
    const fetchImpl = fakeFetch({
      '/data/crism.json': { body: '<!doctype html><html></html>', type: 'text/html' },
      '/data/mock/crism.json': { body: mockJson },
    });
    expect((await loadCrism({ fetchImpl, base })).source).toBe('mock');
  });

  it('falls back (with a warning) when the real JSON exists but the PNG does not', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchImpl = fakeFetch({
      '/data/crism.json': { body: valid() },
      '/data/crism.png': { body: '<!doctype html>', type: 'text/html' }, // SPA fallback, not an image
      '/data/mock/crism.json': { body: mockJson },
    });
    const got = await loadCrism({ fetchImpl, base });
    expect(got.source).toBe('mock');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('does not hide a malformed real JSON behind the mock', async () => {
    const fetchImpl = fakeFetch({
      '/data/crism.json': { body: { ...valid(), acquired: 'yesterday' } },
      '/data/crism.png': { type: 'image/png' },
      '/data/mock/crism.json': { body: mockJson },
    });
    await expect(loadCrism({ fetchImpl, base })).rejects.toThrow(/acquired/);
  });

  it('fails when neither the real nor the mock JSON exists', async () => {
    await expect(loadCrism({ fetchImpl: fakeFetch({}), base })).rejects.toThrow(/CRISM/);
  });

  it('respects a non-root base path', async () => {
    const fetchImpl = fakeFetch({ '/app/data/mock/crism.json': { body: mockJson } });
    expect((await loadCrism({ fetchImpl, base: '/app/' })).imageUrl).toBe('/app/data/mock/crism.png');
  });
});

describe('CRISM provenance line', () => {
  const def = getLayer('crism')!;

  it('shows MRO / CRISM, product ID and acquisition date', () => {
    const line = crismProvenanceParts(def.dataKind ?? '', {
      meta: parseCrism(valid()),
      imageUrl: '/data/crism.png',
      source: 'real',
    }).join(' · ');
    expect(line).toContain('MRO / CRISM');
    expect(line).toContain('FRT00005C5E_07_BRCARJ_MTR3');
    expect(line).toContain('2007-05-19');
    expect(line).not.toMatch(/mock/i);
  });

  it('says clearly when it is mock data', () => {
    const line = crismProvenanceParts(def.dataKind ?? '', {
      meta: parseCrism(mockJson),
      imageUrl: '/data/mock/crism.png',
      source: 'mock',
    }).join(' · ');
    expect(line).toContain('MOCK DATA');
    expect(line).toContain('MRO / CRISM');
  });

  it('has a placeholder before the metadata loads', () => {
    expect(crismProvenanceParts(def.dataKind ?? '', null).join(' ')).toContain('MRO / CRISM');
  });
});
