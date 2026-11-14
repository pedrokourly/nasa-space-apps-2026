import { parseMeta } from '../lib/loadData';
import { gridFromBuffers } from './core/gridBinary';
import type { Grid } from './core/grid';

type FetchFn = (url: string) => Promise<Response>;

/**
 * Downloads `meta.json`, `elevation.bin` and `slope.bin` from `baseUrl` (ending in `/`) and builds the `Grid`.
 * Works in the main thread and in the Worker. `fetchFn` exists for tests.
 */
export async function loadGrid(baseUrl: string, fetchFn: FetchFn = (u) => fetch(u)): Promise<Grid> {
  const get = async (name: string): Promise<Response> => {
    const res = await fetchFn(`${baseUrl}${name}`);
    if (!res.ok) throw new Error(`Failed to load ${baseUrl}${name} (HTTP ${res.status})`);
    return res;
  };
  const [metaRes, elevRes, slopeRes] = await Promise.all([get('meta.json'), get('elevation.bin'), get('slope.bin')]);
  const meta = parseMeta(await metaRes.json());
  const [elevation, slope] = await Promise.all([elevRes.arrayBuffer(), slopeRes.arrayBuffer()]);
  return gridFromBuffers(meta, elevation, slope);
}
