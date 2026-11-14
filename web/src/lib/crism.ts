import type { CrismMeta } from '../types/contract';
import { parseCrism } from './loadData';

/** The CRISM overlay ready to draw: validated metadata, the PNG URL and where both came from. */
export interface LoadedCrism {
  meta: CrismMeta;
  /** URL of the RGBA PNG (`crism.png`), to be placed on `meta.bbox`. */
  imageUrl: string;
  /** `mock` when the real files are missing and the placeholder in `data/mock/` is used. */
  source: 'real' | 'mock';
}

/**
 * Provenance text of the CRISM overlay, read from `crism.json`: mission/instrument, product ID and
 * acquisition date. Mock data says so in the first part.
 */
export function crismProvenanceParts(dataKind: string, crism: LoadedCrism | null): string[] {
  if (!crism) return [`${dataKind}: MRO / CRISM`, 'loading product details…'];
  const { meta } = crism;
  return [
    `${crism.source === 'mock' ? 'MOCK DATA, not a real CRISM product · ' : ''}${dataKind} (${meta.mineral}): MRO / CRISM`,
    `Product ${meta.product_id}`,
    `Acquired ${meta.acquired}${crism.source === 'mock' ? ' (placeholder)' : ''}`,
  ];
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface LoadCrismOptions {
  fetchImpl?: FetchFn;
  /** Site base path, with a trailing slash (default: Vite's `BASE_URL`). */
  base?: string;
  signal?: AbortSignal;
}

const FILES = { json: 'crism.json', png: 'crism.png' } as const;

/**
 * Reads JSON from `url`. Returns `null` when the file is missing: an HTTP error, or a body that is
 * not JSON (static hosts with single-page-app fallback answer a missing file with `index.html`).
 */
async function fetchJsonOrNull(fetchImpl: FetchFn, url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetchImpl(url, { signal });
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** True when `url` answers with an image (and not the single-page-app `index.html`). */
async function imageExists(fetchImpl: FetchFn, url: string, signal?: AbortSignal): Promise<boolean> {
  const res = await fetchImpl(url, { method: 'HEAD', signal });
  return res.ok && (res.headers.get('content-type') ?? '').startsWith('image/');
}

/**
 * Loads the CRISM overlay from `data/crism.json` + `data/crism.png` (Data/GIS). If either real file
 * is missing, falls back to the placeholder in `data/mock/` (flagged `source: 'mock'`).
 * A real `crism.json` that is malformed throws instead of being hidden behind the mock.
 */
export async function loadCrism(opts: LoadCrismOptions = {}): Promise<LoadedCrism> {
  const fetchImpl = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  const base = opts.base ?? import.meta.env.BASE_URL;
  const real = (file: string) => `${base}data/${file}`;
  const mock = (file: string) => `${base}data/mock/${file}`;

  const rawReal = await fetchJsonOrNull(fetchImpl, real(FILES.json), opts.signal);
  if (rawReal !== null) {
    const meta = parseCrism(rawReal);
    if (await imageExists(fetchImpl, real(FILES.png), opts.signal)) {
      return { meta, imageUrl: real(FILES.png), source: 'real' };
    }
    console.warn('data/crism.json exists but data/crism.png does not: using the mock CRISM overlay');
  }

  const rawMock = await fetchJsonOrNull(fetchImpl, mock(FILES.json), opts.signal);
  if (rawMock === null) throw new Error('Failed to load the CRISM overlay (no real or mock crism.json)');
  return { meta: { ...parseCrism(rawMock), mock: true }, imageUrl: mock(FILES.png), source: 'mock' };
}
