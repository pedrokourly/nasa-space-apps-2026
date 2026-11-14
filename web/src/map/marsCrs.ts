import L from 'leaflet';
import { MARS_RADIUS_M } from '../lib/mars-geo';

/**
 * CRS do mapa de Marte: lat/lon puro (EPSG:4326), como os tiles do NASA Mars Trek.
 *
 * `L.CRS.EPSG4326` herda de `L.CRS.Earth`, cujo `R` é o raio da Terra (6371 km).
 * Sem trocar o raio, `map.distance()` e `L.control.scale()` (que chamam `crs.distance`)
 * devolveriam distâncias ~88% maiores que as reais em Marte. Aqui o raio é o de
 * Marte (3389,5 km), o mesmo do haversine de `src/lib/mars-geo.ts`.
 */
export const MarsCRS = L.extend({}, L.CRS.EPSG4326, { R: MARS_RADIUS_M }) as L.CRS;
