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

describe('contract mocks', () => {
  it('bbox sides are between 5 and 15 km', () => {
    const midLat = (minLat + maxLat) / 2;
    const w = haversine([minLon, midLat], [maxLon, midLat]);
    const h = haversine([minLon, minLat], [minLon, maxLat]);
    for (const side of [w, h]) {
      expect(side).toBeGreaterThan(5000);
      expect(side).toBeLessThan(15000);
    }
  });

  it('targets and route vertices are inside the bbox, with longitude in −180..180', () => {
    const pts = [...targets.features.map((t) => t.geometry.coordinates), ...route.geometry.coordinates];
    for (const p of pts) {
      expect(p[0]).toBeGreaterThanOrEqual(-180);
      expect(p[0]).toBeLessThanOrEqual(180);
      expect(inBbox(p)).toBe(true);
    }
  });

  it('every target points to an existing mission', () => {
    const ids = new Set(missions.map((m) => m.id));
    for (const t of targets.features) expect(ids.has(t.properties.mission)).toBe(true);
  });

  it('dist_m matches the sum of haversines and the profile ends at dist_m', () => {
    const c = route.geometry.coordinates;
    let sum = 0;
    for (let i = 1; i < c.length; i++) sum += haversine(c[i - 1], c[i]);
    expect(Math.abs(sum - route.properties.dist_m)).toBeLessThan(1);
    const profile = route.properties.profile;
    expect(profile).toHaveLength(c.length);
    expect(profile[profile.length - 1][0]).toBeCloseTo(route.properties.dist_m, 1);
  });

  it('route passes through at least 2 targets', () => {
    const c = route.geometry.coordinates;
    const hits = targets.features.filter((t) =>
      c.some((p) => haversine(p, t.geometry.coordinates) < 1),
    );
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });
});

describe('validation', () => {
  it('rejects longitude outside −180..180', () => {
    expect(() =>
      parseTargets({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [270, 10] },
            properties: { id: 'a', name: 'a', why: 'a', mission: 'a' },
          },
        ],
      }),
    ).toThrow(/longitude/);
  });

  it('rejects meta without a required field', () => {
    expect(() => parseMeta({ bbox: [0, 0, 1, 1] })).toThrow(/meta\.json/);
  });
});
