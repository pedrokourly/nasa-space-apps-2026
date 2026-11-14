import { createContext, useContext } from 'react';
import type L from 'leaflet';

/**
 * Leaflet map instance. It is `null` until the map is created in `MapView`'s
 * `useEffect`. Components that add layers, targets or a route must be children
 * of `<MapView>` and read the map with `useMap()`.
 */
export const MapContext = createContext<L.Map | null>(null);

/** Returns the Leaflet map, or `null` while it has not been created yet. */
export function useMap(): L.Map | null {
  return useContext(MapContext);
}
