import { describe, expect, it } from 'vitest'
import { TRANSPARENT_TILE_URL, setLoading } from './loadingState'

describe('setLoading', () => {
  it('adds and removes layers without mutating the input', () => {
    const empty = new Set<string>()
    const a = setLoading(empty, 'a', true)
    expect([...a]).toEqual(['a'])
    expect(empty.size).toBe(0)
    const ab = setLoading(a, 'b', true)
    expect(ab.size).toBe(2)
    expect(setLoading(ab, 'a', false).has('a')).toBe(false)
  })

  it('is empty once every layer finished', () => {
    const s = setLoading(setLoading(new Set<string>(), 'a', true), 'a', false)
    expect(s.size).toBe(0)
  })
})

describe('TRANSPARENT_TILE_URL', () => {
  it('is an image data URI', () => {
    expect(TRANSPARENT_TILE_URL.startsWith('data:image/')).toBe(true)
  })
})
