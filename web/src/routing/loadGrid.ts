import { parseMeta } from '../lib/loadData';
import { gridFromBuffers } from './core/gridBinary';
import type { Grid } from './core/grid';

type FetchFn = (url: string) => Promise<Response>;

/**
 * Downloads `meta.json`, `elevation.bin` and `slope.bin` from `baseUrl` (ending in `/`), plus `sand.bin`
 * when `meta.sand_layer` is `true`, and builds the `Grid`. The sand file is only requested when meta says
 * it exists: a static host may answer a missing file with the app's HTML instead of a 404.
 * Works in the main thread and in the Worker. `fetchFn` exists for tests.
 */
export async function loadGrid(baseUrl: string, fetchFn: FetchFn = (u) => fetch(u)): Promise<Grid> {
  const get = async (name: string): Promise<Response> => {
    const res = await fetchFn(`${baseUrl}${name}`);
    if (!res.ok) throw new Error(`Failed to load ${baseUrl}${name} (HTTP ${res.status})`);
    return res;
  };
  const meta = parseMeta(await (await get('meta.json')).json());
  const files = ['elevation.bin', 'slope.bin', ...(meta.sand_layer ? ['sand.bin'] : [])];
  const [elevation, slope, sand] = await Promise.all(files.map(async (f) => (await get(f)).arrayBuffer()));
  return gridFromBuffers(meta, elevation!, slope!, sand);
}
