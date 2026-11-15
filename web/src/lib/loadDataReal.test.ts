/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadData } from './loadData';
import { loadGrid } from '../routing/loadGrid';

const dataDir = new URL('../../public/data/', import.meta.url);
const diskFetch = async (url: string): Promise<Response> => {
  const file = url.slice(url.lastIndexOf('/') + 1);
  return new Response(readFileSync(new URL(file, dataDir)));
};

afterEach(() => vi.unstubAllGlobals());

describe('loadData with every source real (issue #32)', () => {
  it('loads meta, targets and missions from public/data without error and without console errors', async () => {
    vi.stubGlobal('fetch', diskFetch);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const data = await loadData({ meta: 'real', targets: 'real', missions: 'real' });
    expect(data.meta.width).toBe(512);
    expect(data.targets.features.length).toBeGreaterThanOrEqual(3);
    expect(data.missions.length).toBeGreaterThan(0);
    expect(errors).not.toHaveBeenCalled();
  });

  it('loads elevation.bin and slope.bin on the same grid as meta.json', async () => {
    const grid = await loadGrid('/data/', diskFetch);
    const cells = grid.meta.width * grid.meta.height;
    expect(grid.elevation.length).toBe(cells);
    expect(grid.slope.length).toBe(cells);
  });
});
