import { useEffect, useRef, useState, type ReactNode } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MarsCRS } from './marsCrs';
import { MapContext } from './MapContext';
import { formatLatLon } from './format';
import './MapView.css';

/** The area of interest near the Perseverance landing site [lat, lon]. */
const JEZERO_CENTER: L.LatLngTuple = [18.45, 77.43];
/** Shows the whole 6 m CTX mosaic (~30 km) on desktop screens. */
const JEZERO_ZOOM = 10;

/** Opening view: the whole planet (z1 = 1024 × 512 px), centered on Jezero's longitude. */
const PLANET_ZOOM = 1;
const PLANET_CENTER: L.LatLngTuple = [15, 77.43];
/** Pause on the planet before flying in, and the flight duration (s). */
const INTRO_DELAY_MS = 900;
const INTRO_DURATION_S = 4;

/** Whole planet is reachable; HiRISE Jezero goes up to native z17. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 17;
/** Keeps panning on the planet (no wrap-around copies of the map). */
const WORLD_BOUNDS: L.LatLngBoundsLiteral = [
  [-90, -180],
  [90, 180],
];

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Leaflet control under the zoom buttons that flies back to the area of interest. */
const JezeroControl = L.Control.extend({
  onAdd(map: L.Map) {
    const bar = L.DomUtil.create('div', 'leaflet-bar map-view__home');
    const button = L.DomUtil.create('a', '', bar);
    button.href = '#';
    button.title = 'Back to Jezero';
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', 'Back to Jezero');
    button.textContent = '⌂';
    L.DomEvent.disableClickPropagation(bar);
    L.DomEvent.on(button, 'click', (e) => {
      L.DomEvent.preventDefault(e);
      if (prefersReducedMotion()) map.setView(JEZERO_CENTER, JEZERO_ZOOM);
      else map.flyTo(JEZERO_CENTER, JEZERO_ZOOM, { duration: 2 });
    });
    return bar;
  },
});

interface MapViewProps {
  /** Layers and controls that use `useMap()` (LayerManager, #9 and #11). */
  children?: ReactNode;
  /** Called once when the map is created. */
  onReady?: (map: L.Map) => void;
}

export default function MapView({ children, onReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  const [map, setMap] = useState<L.Map | null>(null);
  const [cursor, setCursor] = useState<L.LatLng | null>(null);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduced = prefersReducedMotion();
    const instance = L.map(container, {
      crs: MarsCRS,
      center: reduced ? JEZERO_CENTER : PLANET_CENTER,
      zoom: reduced ? JEZERO_ZOOM : PLANET_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      maxBounds: WORLD_BOUNDS,
      maxBoundsViscosity: 1,
    });

    new JezeroControl({ position: 'topleft' }).addTo(instance);
    // With MarsCRS, the scale uses R = 3389.5 km.
    L.control.scale({ metric: true, imperial: false }).addTo(instance);

    instance.on('mousemove', (e: L.LeafletMouseEvent) => setCursor(e.latlng));
    instance.on('mouseout', () => setCursor(null));

    // Opening shot: show the planet, then fly into the crater. Any user interaction cancels it.
    let introTimer: number | undefined;
    const cancelIntro = () => window.clearTimeout(introTimer);
    if (!reduced) {
      introTimer = window.setTimeout(() => {
        instance.flyTo(JEZERO_CENTER, JEZERO_ZOOM, { duration: INTRO_DURATION_S });
      }, INTRO_DELAY_MS);
      instance.once('mousedown touchstart wheel keydown', cancelIntro);
    }

    setMap(instance);
    onReadyRef.current?.(instance);

    return () => {
      cancelIntro();
      instance.remove();
      setMap(null);
    };
  }, []);

  return (
    <div className="map-view">
      <div ref={containerRef} className="map-view__canvas" />
      <div className="map-view__coords" aria-live="off">
        {cursor ? formatLatLon(cursor.lat, cursor.lng) : 'Hover over the map'}
      </div>
      <MapContext.Provider value={map}>{children}</MapContext.Provider>
    </div>
  );
}
