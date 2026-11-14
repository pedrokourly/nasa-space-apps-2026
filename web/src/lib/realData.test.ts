/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isInsideBbox } from './bbox';
import { parseMeta, parseMissions, parseTargets } from './loadData';

const dir = new URL('../../public/data/', import.meta.url);
const read = (f: string): unknown => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));

const meta = parseMeta(read('meta.json'));
const targets = parseTargets(read('targets.geojson'));
const missions = parseMissions(read('missions.json'));

describe('real data in public/data', () => {
  it('missions have unique ids, https links and a description', () => {
    const ids = missions.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of missions) {
      expect(m.link, m.id).toMatch(/^https:\/\//);
      expect(m.description?.trim(), m.id).toBeTruthy();
    }
  });

  it('every real target points at a listed mission and lies inside the planning area', () => {
    const ids = new Set(missions.map((m) => m.id));
    for (const t of targets.features) {
      expect(ids.has(t.properties.mission), t.properties.id).toBe(true);
      expect(isInsideBbox(t.geometry.coordinates, meta.bbox), t.properties.id).toBe(true);
      expect(t.properties.mock, t.properties.id).not.toBe(true);
    }
  });
});
