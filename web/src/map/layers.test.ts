import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BASE_ID, LAYERS, getLayer } from './layers';
import { useAppStore } from '../state/store';

const missions = JSON.parse(
  readFileSync(new URL('../../public/data/mock/missions.json', import.meta.url), 'utf8'),
) as { id: string }[];

describe('registro de camadas', () => {
  it('tem pelo menos 4 camadas de 3 missões distintas', () => {
    expect(LAYERS.length).toBeGreaterThanOrEqual(4);
    expect(new Set(LAYERS.map((l) => l.missionId)).size).toBeGreaterThanOrEqual(3);
  });

  it('ids são únicos e cada missionId existe em missions.json', () => {
    expect(new Set(LAYERS.map((l) => l.id)).size).toBe(LAYERS.length);
    const ids = new Set(missions.map((m) => m.id));
    for (const l of LAYERS) expect(ids.has(l.missionId), `${l.id} -> ${l.missionId}`).toBe(true);
  });

  it('toda camada tem produto e fonteUrl não vazios', () => {
    for (const l of LAYERS) {
      expect(l.produto.trim(), l.id).not.toBe('');
      expect(l.fonteUrl.trim(), l.id).not.toBe('');
      expect(l.fonteUrl).toContain(l.produto);
    }
  });

  it('bounds usam longitude −180 a 180 e latitude −90 a 90', () => {
    for (const l of LAYERS) {
      const [[sul, oeste], [norte, leste]] = l.bounds;
      expect(oeste).toBeGreaterThanOrEqual(-180);
      expect(leste).toBeLessThanOrEqual(180);
      expect(oeste).toBeLessThan(leste);
      expect(sul).toBeGreaterThanOrEqual(-90);
      expect(norte).toBeLessThanOrEqual(90);
      expect(sul).toBeLessThan(norte);
    }
  });

  it('tem atribuição e zoom nativo máximo em todas', () => {
    for (const l of LAYERS) {
      expect(l.attribution).not.toBe('');
      expect(l.maxNativeZoom).toBeGreaterThan(0);
    }
  });

  it('abre com exatamente uma base ativa', () => {
    const ativas = useAppStore.getState().activeLayers;
    const basesAtivas = ativas.filter((id) => getLayer(id)?.tipo === 'base');
    expect(basesAtivas).toEqual([DEFAULT_BASE_ID]);
  });
});
