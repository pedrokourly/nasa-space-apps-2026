import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BASE_ID, LAYERS, getLayer, isTileLayer } from './layers';
import { useAppStore } from '../state/store';

const missions = JSON.parse(
  readFileSync(new URL('../../public/data/mock/missions.json', import.meta.url), 'utf8'),
) as { id: string }[];

describe('layer registry', () => {
  it('has at least 4 layers from 3 distinct missions', () => {
    expect(LAYERS.length).toBeGreaterThanOrEqual(4);
    expect(new Set(LAYERS.map((l) => l.missionId)).size).toBeGreaterThanOrEqual(3);
  });

  it('ids are unique and every missionId exists in missions.json', () => {
    expect(new Set(LAYERS.map((l) => l.id)).size).toBe(LAYERS.length);
    const ids = new Set(missions.map((m) => m.id));
    for (const l of LAYERS) expect(ids.has(l.missionId), `${l.id} -> ${l.missionId}`).toBe(true);
  });

  it('every layer has a non-empty product and sourceUrl', () => {
    for (const l of LAYERS) {
      expect(l.product.trim(), l.id).not.toBe('');
      expect(l.sourceUrl.trim(), l.id).not.toBe('');
      // Tile layers link their own Mars Trek product page.
      if (isTileLayer(l)) expect(l.sourceUrl).toContain(l.product);
    }
  });

  it('bounds use longitude −180 to 180 and latitude −90 to 90', () => {
    for (const l of LAYERS) {
      const [[south, west], [north, east]] = l.bounds;
      expect(west).toBeGreaterThanOrEqual(-180);
      expect(east).toBeLessThanOrEqual(180);
      expect(west).toBeLessThan(east);
      expect(south).toBeGreaterThanOrEqual(-90);
      expect(north).toBeLessThanOrEqual(90);
      expect(south).toBeLessThan(north);
    }
  });

  it('every layer has an attribution and a max native zoom', () => {
    for (const l of LAYERS) {
      expect(l.attribution).not.toBe('');
      if (isTileLayer(l)) expect(l.maxNativeZoom).toBeGreaterThan(0);
    }
  });

  it('opens with exactly one active base', () => {
    const active = useAppStore.getState().activeLayers;
    const activeBases = active.filter((id) => getLayer(id)?.type === 'base');
    expect(activeBases).toEqual([DEFAULT_BASE_ID]);
  });
});
