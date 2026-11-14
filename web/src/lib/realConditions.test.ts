/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ConditionVariable, Conditions } from '../types/contract';

const dir = new URL('../../public/data/', import.meta.url);
const conditions = JSON.parse(readFileSync(new URL('conditions.json', dir), 'utf8')) as Conditions;
const missions = JSON.parse(readFileSync(new URL('mock/missions.json', dir), 'utf8')) as { id: string }[];

const variables = (): [number, string, ConditionVariable][] =>
  conditions.sols.flatMap((s) => Object.entries(s.variables).map(([k, v]) => [s.sol, k, v] as [number, string, ConditionVariable]));

describe('real conditions.json', () => {
  it('lists at least 3 sols, latest first, and names the latest one', () => {
    expect(conditions.sols.length).toBeGreaterThanOrEqual(3);
    const sols = conditions.sols.map((s) => s.sol);
    expect(sols).toEqual([...sols].sort((a, b) => b - a));
    expect(conditions.latest_sol).toBe(sols[0]);
  });

  it('cites the PDS release, the DOI and a mission that exists in missions.json', () => {
    expect(conditions.source.release).toMatch(/^mars2020_meda-\d{8}$/);
    expect(conditions.source.doi).toBe('10.17189/1522849');
    expect(missions.some((m) => m.id === conditions.source.mission_id)).toBe(true);
  });

  it('gives every available variable a unit and ordered min, mean and max', () => {
    for (const [, , v] of variables()) {
      if (v.status === 'ok') {
        expect(v.unit).not.toBe('');
        expect(v.min).toBeLessThanOrEqual(v.mean);
        expect(v.mean).toBeLessThanOrEqual(v.max);
      }
    }
  });

  it('never gives numbers to an unavailable variable', () => {
    for (const [, , v] of variables()) {
      if (v.status === 'unavailable') {
        expect(v.reason).not.toBe('');
        expect(Object.keys(v).sort()).toEqual(['reason', 'status']);
      }
    }
  });
});
