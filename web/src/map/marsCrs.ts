import L from 'leaflet';
import { MARS_RADIUS_M } from '../lib/mars-geo';

/**
 * Mars map CRS: plain lat/lon (EPSG:4326), like the NASA Mars Trek tiles.
 *
 * `L.CRS.EPSG4326` inherits from `L.CRS.Earth`, whose `R` is Earth's radius (6371 km).
 * Without swapping the radius, `map.distance()` and `L.control.scale()` (which call `crs.distance`)
 * would return distances ~88% larger than the real ones on Mars. Here the radius is Mars's
 * (3389.5 km), the same as the haversine in `src/lib/mars-geo.ts`.
 */
export const MarsCRS = L.extend({}, L.CRS.EPSG4326, { R: MARS_RADIUS_M }) as L.CRS;
