/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findHabitat, parseMeta, parseMissions, parseTargets } from './loadData';
import { isInsideBbox } from './bbox';

const dir = new URL('../../public/data/', import.meta.url);
const read = (f: string): unknown => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));

const meta = parseMeta(read('meta.json'));
const targets = parseTargets(read('targets.geojson'));
const missions = parseMissions(read('mock/missions.json'));

describe('real targets.geojson', () => {
  it('is accepted by the app parser, with 3 to 5 targets', () => {
    expect(targets.features.length).toBeGreaterThanOrEqual(3);
    expect(targets.features.length).toBeLessThanOrEqual(5);
  });

  it('has a habitat feature the router can measure the way home against (#69)', () => {
    const habitat = findHabitat(targets);
    expect(habitat).not.toBeNull();
    expect(isInsideBbox(habitat!, meta.bbox)).toBe(true);
    expect(findHabitat({ type: 'FeatureCollection', features: [] })).toBeNull();
  });

  it('keeps every target inside the real meta.json bbox', () => {
    for (const t of targets.features) expect(isInsideBbox(t.geometry.coordinates, meta.bbox)).toBe(true);
  });

  it('points every target to an existing mission', () => {
    const ids = new Set(missions.map((m) => m.id));
    for (const t of targets.features) expect(ids.has(t.properties.mission)).toBe(true);
  });

  it('is not flagged as mock', () => {
    for (const t of targets.features) expect(t.properties.mock).toBeUndefined();
  });
});
