import { describe, expect, it } from 'vitest';
import { encodeRouteHash, parseRouteHash } from './routeHash';

describe('routeHash', () => {
  it('encodes with 5 decimals', () => {
    expect(encodeRouteHash([[77.45, 18.4], [77.4512345678, 18.41]])).toBe('#route=77.45000,18.40000;77.45123,18.41000');
  });
  it('encodes empty as an empty string', () => {
    expect(encodeRouteHash([])).toBe('');
  });
  it('round-trips', () => {
    const pts: [number, number][] = [[77.45, 18.4], [-120.12345, -5.5]];
    expect(parseRouteHash(encodeRouteHash(pts))).toEqual(pts);
  });
  it('accepts a single point', () => {
    expect(parseRouteHash('#route=10,20')).toEqual([[10, 20]]);
  });
  it.each([
    '', '#', '#route=', '#other=1,2', '#route=abc', '#route=1,2;', '#route=1', '#route=1,2,3',
    '#route=NaN,1', '#route=Infinity,1', '#route=181,0', '#route=0,91', '#route=,1', '#route=1,2;x,y',
  ])('rejects %j', (h) => {
    expect(parseRouteHash(h)).toBeNull();
  });
  it('never throws on non-string input', () => {
    expect(parseRouteHash(undefined as unknown as string)).toBeNull();
  });
});
