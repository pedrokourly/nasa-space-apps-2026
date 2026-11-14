import { useEffect, useRef, useState, type ReactNode } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MarsCRS } from './marsCrs';
import { MapContext } from './MapContext';
import { formatLatLon } from './format';
import './MapView.css';

/** Initial center: Jezero crater [lat, lon]. */
const JEZERO_CENTER: L.LatLngTuple = [18.44, 77.45];

/** Shows the whole crater (~45 km) on desktop screens. */
const INITIAL_ZOOM = 9;
/** Below z8 the area limited by maxBounds becomes smaller than the screen. */
const MIN_ZOOM = 8;
/** HiRISE Jezero goes up to native z17. */
const MAX_ZOOM = 17;

/** Coverage of the preliminary CTX Jezero (spike #2): [[south, west], [north, east]]. */
const JEZERO_BOUNDS: L.LatLngBoundsLiteral = [
  [15.9058, 75.1538],
  [19.4453, 78.8717],
];

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

    const instance = L.map(container, {
      crs: MarsCRS,
      center: JEZERO_CENTER,
      zoom: INITIAL_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      maxBounds: JEZERO_BOUNDS,
      maxBoundsViscosity: 1,
    });

    // With MarsCRS, the scale uses R = 3389.5 km.
    L.control.scale({ metric: true, imperial: false }).addTo(instance);

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
      <div className="map-view__coords" aria-live="off">
        {cursor ? formatLatLon(cursor.lat, cursor.lng) : 'Hover over the map'}
      </div>
      <MapContext.Provider value={map}>{children}</MapContext.Provider>
    </div>
  );
}
