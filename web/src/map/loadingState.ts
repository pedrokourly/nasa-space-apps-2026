/** Pure bookkeeping for "which tile layers are still loading" (no Leaflet, no React). */

/** 1x1 fully transparent GIF: shown for missing tiles so the dark map background shows through. */
export const TRANSPARENT_TILE_URL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/** Returns a new set with `id` added (loading) or removed (done). */
export function setLoading(loading: ReadonlySet<string>, id: string, isLoading: boolean): Set<string> {
  const next = new Set(loading)
  if (isLoading) next.add(id)
  else next.delete(id)
  return next
}
