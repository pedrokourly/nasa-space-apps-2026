/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Meta, Mission, Route, TargetsCollection } from '../types/contract';
import { parseMeta, parseMissions, parseRoute, parseTargets } from './loadData';
import { haversine, type LonLat } from './mars-geo';

const dir = new URL('../../public/data/mock/', import.meta.url);
const read = (f: string): unknown => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));

const meta: Meta = parseMeta(read('meta.json'));
const targets: TargetsCollection = parseTargets(read('targets.geojson'));
const missions: Mission[] = parseMissions(read('missions.json'));
const route: Route = parseRoute(read('route.geojson'));

const [minLon, minLat, maxLon, maxLat] = meta.bbox;
const inBbox = ([lon, lat]: LonLat) => lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;

describe('mocks do contrato', () => {
  it('bbox tem lados entre 5 e 15 km', () => {
    const midLat = (minLat + maxLat) / 2;
    const w = haversine([minLon, midLat], [maxLon, midLat]);
    const h = haversine([minLon, minLat], [minLon, maxLat]);
    for (const side of [w, h]) {
      expect(side).toBeGreaterThan(5000);
      expect(side).toBeLessThan(15000);
    }
  });

  it('alvos e vértices da rota ficam dentro do bbox, com longitude em −180..180', () => {
    const pts = [...targets.features.map((t) => t.geometry.coordinates), ...route.geometry.coordinates];
    for (const p of pts) {
      expect(p[0]).toBeGreaterThanOrEqual(-180);
      expect(p[0]).toBeLessThanOrEqual(180);
      expect(inBbox(p)).toBe(true);
    }
  });

  it('todo alvo aponta para uma missão existente', () => {
    const ids = new Set(missions.map((m) => m.id));
    for (const t of targets.features) expect(ids.has(t.properties.missao)).toBe(true);
  });

  it('dist_m bate com a soma dos haversines e o perfil termina em dist_m', () => {
    const c = route.geometry.coordinates;
    let soma = 0;
    for (let i = 1; i < c.length; i++) soma += haversine(c[i - 1], c[i]);
    expect(Math.abs(soma - route.properties.dist_m)).toBeLessThan(1);
    const perfil = route.properties.perfil;
    expect(perfil).toHaveLength(c.length);
    expect(perfil[perfil.length - 1][0]).toBeCloseTo(route.properties.dist_m, 1);
  });

  it('rota passa por pelo menos 2 alvos', () => {
    const c = route.geometry.coordinates;
    const hits = targets.features.filter((t) =>
      c.some((p) => haversine(p, t.geometry.coordinates) < 1),
    );
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });
});

describe('validação', () => {
  it('rejeita longitude fora de −180..180', () => {
    expect(() =>
      parseTargets({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [270, 10] },
            properties: { id: 'a', nome: 'a', por_que: 'a', missao: 'a' },
          },
        ],
      }),
    ).toThrow(/longitude/);
  });

  it('rejeita meta sem campo obrigatório', () => {
    expect(() => parseMeta({ bbox: [0, 0, 1, 1] })).toThrow(/meta\.json/);
  });
});
