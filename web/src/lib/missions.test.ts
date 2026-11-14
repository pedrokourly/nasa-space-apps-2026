import { describe, expect, it } from 'vitest';
import type { Mission } from '../types/contract';
import { findMission } from './missions';

const missions: Mission[] = [
  { id: 'a', name: 'A', instrument: 'i', agency: 'NASA', link: 'https://example.org' },
  { id: 'b', name: 'B', instrument: 'j', agency: 'ESA', link: 'https://example.org' },
];

describe('findMission', () => {
  it('finds the mission by id', () => {
    expect(findMission(missions, 'b')?.name).toBe('B');
  });
  it('returns undefined when it does not exist', () => {
    expect(findMission(missions, 'x')).toBeUndefined();
  });
});
