import { useEffect, useRef, useState, type ReactNode } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MarsCRS } from './marsCrs';
import { MapContext } from './MapContext';
import { formatLatLon } from './format';
import './MapView.css';

/** Initial center: the area of interest near the Perseverance landing site [lat, lon]. */
const JEZERO_CENTER: L.LatLngTuple = [18.45, 77.43];

/** Shows the whole 6 m CTX mosaic (~30 km) on desktop screens. */
const INITIAL_ZOOM = 10;
/** Below z9 the area limited by maxBounds becomes smaller than the screen. */
const MIN_ZOOM = 9;
/** HiRISE Jezero goes up to native z17. */
const MAX_ZOOM = 17;

/**
 * Jezero crater (~45 km) plus a margin: [[south, west], [north, east]].
 * The controlled 6 m CTX mosaic covers the center; MOLA fills the rest as backdrop.
 */
const JEZERO_BOUNDS: L.LatLngBoundsLiteral = [
  [17.95, 77.05],
  [18.9, 78.05],
];

interface MapViewProps {
  /** Layers and controls that use `useMap()` (LayerManager, #9 and #11). */
  children?: ReactNode;
  /** Called once when the map is created. */
  onReady?: (map: L.Map) => void;
}

export default function MapView({ children, onReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const telemetryRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  const [map, setMap] = useState<L.Map | null>(null);
  const [cursor, setCursor] = useState<L.LatLng | null>(null);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const instance = L.map(container, {
      crs: MarsCRS,
      center: JEZERO_CENTER,
      zoom: INITIAL_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      maxBounds: JEZERO_BOUNDS,
      maxBoundsViscosity: 1,
      // No + / − buttons: scroll, pinch and double-click zoom remain.
      zoomControl: false,
    });

    // With MarsCRS, the scale uses R = 3389.5 km.
    const scale = L.control.scale({ metric: true, imperial: false }).addTo(instance);
    const scaleElement = scale.getContainer();
    if (telemetryRef.current && scaleElement) telemetryRef.current.appendChild(scaleElement);

    instance.on('mousemove', (e: L.LeafletMouseEvent) => setCursor(e.latlng));
    instance.on('mouseout', () => setCursor(null));

    setMap(instance);
    onReadyRef.current?.(instance);

    return () => {
      instance.remove();
      setMap(null);
    };
  }, []);

  return (
    <div className="map-view">
      <div ref={containerRef} className="map-view__canvas" />
      <div className="map-view__telemetry" ref={telemetryRef}>
      <div className="map-view__coords" aria-live="off">
        {cursor ? formatLatLon(cursor.lat, cursor.lng) : 'Hover over the map'}
      </div>
      </div>
      <MapContext.Provider value={map}>{children}</MapContext.Provider>
    </div>
  );
}
