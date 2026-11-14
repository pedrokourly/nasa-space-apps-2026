import { describe, expect, it } from 'vitest'
import { MARS_RADIUS_M, haversine, type LonLat } from '../lib/mars-geo'
import {
  classifySlope,
  fillMissingHeights,
  groupSlopeRuns,
  segmentSlopesDeg,
  slopeDeg,
} from './routeSlope'

describe('slopeDeg', () => {
  it('is 0 on flat ground and 45 when rise equals run', () => {
    expect(slopeDeg(100, 0)).toBe(0)
    expect(slopeDeg(100, 100)).toBeCloseTo(45, 10)
    expect(slopeDeg(100, -100)).toBeCloseTo(45, 10)
  })

  it('is 90 for a vertical step and 0 for no movement at all', () => {
    expect(slopeDeg(0, 5)).toBe(90)
    expect(slopeDeg(0, 0)).toBe(0)
  })
})

describe('segmentSlopesDeg', () => {
  it('uses the Mars radius for the horizontal distance', () => {
    const a: LonLat = [77.4, 18.4]
    const b: LonLat = [77.4, 18.4 + 0.001]
    const run = haversine(a, b)
    // 0.001° of latitude on Mars is about 59.2 m (Earth would give about 111 m).
    expect(run).toBeCloseTo((MARS_RADIUS_M * 0.001 * Math.PI) / 180, 6)
    const [slope] = segmentSlopesDeg([a, b], [0, run])
    expect(slope).toBeCloseTo(45, 6)
  })

  it('returns one value per segment and rejects mismatched lengths', () => {
    const pts: LonLat[] = [
      [0, 0],
      [0, 0.001],
      [0, 0.002],
    ]
    expect(segmentSlopesDeg(pts, [0, 0, 0])).toEqual([0, 0])
    expect(() => segmentSlopesDeg(pts, [0, 0])).toThrow()
  })
})

describe('classifySlope', () => {
  it('splits at 10 and 20 degrees (20 is still amber)', () => {
    expect(classifySlope(0)).toBe('easy')
    expect(classifySlope(9.99)).toBe('easy')
    expect(classifySlope(10)).toBe('moderate')
    expect(classifySlope(20)).toBe('moderate')
    expect(classifySlope(20.01)).toBe('steep')
    expect(classifySlope(90)).toBe('steep')
  })
})

describe('groupSlopeRuns', () => {
  it('merges consecutive segments of the same class and shares the boundary vertex', () => {
    expect(groupSlopeRuns(['easy', 'easy', 'steep', 'easy'])).toEqual([
      { cls: 'easy', from: 0, to: 2 },
      { cls: 'steep', from: 2, to: 3 },
      { cls: 'easy', from: 3, to: 4 },
    ])
  })

  it('returns no runs for no segments', () => {
    expect(groupSlopeRuns([])).toEqual([])
  })
})

describe('fillMissingHeights', () => {
  it('fills gaps with the nearest known neighbor', () => {
    expect(fillMissingHeights([undefined, 10, undefined, undefined, 20])).toEqual([
      10, 10, 10, 10, 20,
    ])
    expect(fillMissingHeights([1, Number.NaN, 3])).toEqual([1, 1, 3])
  })

  it('returns null when nothing is known', () => {
    expect(fillMissingHeights([undefined, undefined])).toBeNull()
    expect(fillMissingHeights([])).toBeNull()
  })
})
