import { describe, expect, it } from 'vitest'
import { isTileInBounds, isUnhealthy, pruneErrors, recordError } from './tileErrors'

describe('tileHealth', () => {
  it('is healthy below the threshold', () => {
    expect(isUnhealthy([0, 1000], 2000)).toBe(false)
  })

  it('is unhealthy with 3 errors inside the window', () => {
    expect(isUnhealthy([0, 1000, 2000], 3000)).toBe(true)
  })

  it('ignores errors older than the window', () => {
    expect(isUnhealthy([0, 1000, 20_000], 21_000)).toBe(false)
    expect(pruneErrors([0, 5000, 12_000], 12_500)).toEqual([5000, 12_000])
  })

  it('recordError appends and prunes', () => {
    expect(recordError([0, 9000], 15_000)).toEqual([9000, 15_000])
  })

  it('treats tiles without bounds as in bounds and respects bounds otherwise', () => {
    const b = { contains: (p: { lat: number; lng: number }) => p.lat >= 0 }
    expect(isTileInBounds(undefined, { lat: -5, lng: 0 })).toBe(true)
    expect(isTileInBounds(b, { lat: 1, lng: 0 })).toBe(true)
    expect(isTileInBounds(b, { lat: -1, lng: 0 })).toBe(false)
  })
})
