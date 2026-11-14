import { describe, expect, it } from 'vitest';
import type { Mission } from '../types/contract';
import { findMission } from './missions';

const missions: Mission[] = [
  { id: 'a', nome: 'A', instrumento: 'i', agencia: 'NASA', link: 'https://example.org' },
  { id: 'b', nome: 'B', instrumento: 'j', agencia: 'ESA', link: 'https://example.org' },
];

describe('findMission', () => {
  it('acha a missão pelo id', () => {
    expect(findMission(missions, 'b')?.nome).toBe('B');
  });
  it('devolve undefined quando não existe', () => {
    expect(findMission(missions, 'x')).toBeUndefined();
  });
});
