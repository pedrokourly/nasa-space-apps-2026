import { describe, expect, it } from 'vitest';
import { encodeFloat32LE } from './core/gridBinary';
import { mockMeta } from './core/mockGrid';
import { route } from './core/route';
import { cellToLonLat } from './core/grid';
import { loadGrid } from './loadGrid';

/** In-memory static host: unknown files answer 404, and the requested names are recorded. */
function fakeHost(files: Record<string, string | ArrayBuffer>) {
  const requested: string[] = [];
  const fetchFn = async (url: string): Promise<Response> => {
    const name = url.slice(url.lastIndexOf('/') + 1);
    requested.push(name);
    return name in files ? new Response(files[name]) : new Response(null, { status: 404 });
  };
  return { fetchFn, requested };
}

const W = 7;
const H = 3;
const zeros = () => encodeFloat32LE(new Float32Array(W * H)).buffer as ArrayBuffer;

describe('loadGrid', () => {
  it('without sand_layer it does not request sand.bin', async () => {
    const host = fakeHost({ 'meta.json': JSON.stringify(mockMeta(W, H)), 'elevation.bin': zeros(), 'slope.bin': zeros() });
    const g = await loadGrid('/data/', host.fetchFn);
    expect(g.sand).toBeUndefined();
    expect(host.requested).not.toContain('sand.bin');
  });

  it('with sand_layer the sand cells cost 2× and the route goes around them', async () => {
    // A 3-column sand band in the middle, free on the bottom row: going around (~7.7 cells)
    // is cheaper than crossing it at 2× (9 cells).
    const sand = new Uint8Array(W * H);
    for (let row = 0; row < H - 1; row++) for (let col = 2; col <= 4; col++) sand[row * W + col] = 1;
    const meta = { ...mockMeta(W, H), sand_layer: true };
    const host = fakeHost({ 'meta.json': JSON.stringify(meta), 'elevation.bin': zeros(), 'slope.bin': zeros(), 'sand.bin': sand.buffer });
    const g = await loadGrid('/data/', host.fetchFn);
    expect(host.requested).toContain('sand.bin');
    const r = route(g, [cellToLonLat(g.meta, 0, 0), cellToLonLat(g.meta, 6, 0)]);
    const onSand = r.geometry.coordinates.some(([lon, lat]) => {
      const col = Math.floor(((lon - g.meta.bbox[0]) / (g.meta.bbox[2] - g.meta.bbox[0])) * W);
      const row = Math.floor(((g.meta.bbox[3] - lat) / (g.meta.bbox[3] - g.meta.bbox[1])) * H);
      return sand[row * W + col] === 1;
    });
    expect(onSand).toBe(false);
  });

  it('sand_layer: true with no sand.bin on the host gives a clear error', async () => {
    const meta = { ...mockMeta(W, H), sand_layer: true };
    const host = fakeHost({ 'meta.json': JSON.stringify(meta), 'elevation.bin': zeros(), 'slope.bin': zeros() });
    await expect(loadGrid('/data/', host.fetchFn)).rejects.toThrow(/sand\.bin \(HTTP 404\)/);
  });
});
