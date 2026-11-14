import { describe, expect, it } from 'vitest';
import type { Route } from '../types/contract';
import { profilePointAt } from './profilePoint';

const route: Route = {
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: [
      [77.4, 18.44],
      [77.41, 18.45],
      [77.42, 18.46],
    ],
  },
  properties: {
    dist_m: 1200,
    time_s: 1200,
    o2_kg: 0.03,
    profile: [
      [0, -2500],
      [600, -2480],
      [1200, -2490],
    ],
    point_of_no_return: 1,
  },
};

describe('profilePointAt', () => {
  it('returns vertex, distance and elevation for the profile index', () => {
    expect(profilePointAt(route, 1)).toEqual({ lonlat: [77.41, 18.45], dist_m: 600, elev_m: -2480 });
    expect(profilePointAt(route, 2)?.dist_m).toBe(1200);
  });

  it('returns null for a missing or out-of-route index', () => {
    expect(profilePointAt(route, null)).toBeNull();
    expect(profilePointAt(route, undefined)).toBeNull();
    expect(profilePointAt(route, -1)).toBeNull();
    expect(profilePointAt(route, 3)).toBeNull();
    expect(profilePointAt(route, 0.5)).toBeNull();
    expect(profilePointAt(null, 0)).toBeNull();
  });

  it('returns null if the profile is shorter than the geometry', () => {
    const short: Route = { ...route, properties: { ...route.properties, profile: [[0, -2500]] } };
    expect(profilePointAt(short, 1)).toBeNull();
  });
});
