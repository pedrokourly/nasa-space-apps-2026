import { useEffect, useRef, useState, type ReactNode } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MarsCRS } from './marsCrs';
import { MapContext } from './MapContext';
import { formatLatLon } from './format';
import './MapView.css';

/** Centro inicial: cratera Jezero [lat, lon]. */
const JEZERO_CENTER: L.LatLngTuple = [18.44, 77.45];

/** Mostra a cratera inteira (~45 km) em telas de desktop. */
const INITIAL_ZOOM = 9;
/** Abaixo do z8 a área limitada pelo maxBounds fica menor que a tela. */
const MIN_ZOOM = 8;
/** HiRISE Jezero vai até o z17 nativo. */
const MAX_ZOOM = 17;

/** Cobertura do CTX Jezero preliminar (spike #2): [[sul, oeste], [norte, leste]]. */
const JEZERO_BOUNDS: L.LatLngBoundsLiteral = [
  [15.9058, 75.1538],
  [19.4453, 78.8717],
];

const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ/';

interface MapViewProps {
  /** Camadas e controles que usam `useMap()` (issues #7, #9 e #11). */
  children?: ReactNode;
  /** Chamado uma vez quando o mapa é criado. */
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

    // Base: MOLA color hillshade global (MGS/MOLA), nativo até o z7 e ampliado acima.
    L.tileLayer(
      `${TREK}Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`,
      {
        tileSize: 256,
        maxNativeZoom: 7,
        maxZoom: MAX_ZOOM,
        attribution: 'NASA Mars Trek · MGS/MOLA',
      },
    ).addTo(instance);

    // Com MarsCRS, a escala usa R = 3389,5 km.
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
        {cursor ? formatLatLon(cursor.lat, cursor.lng) : 'Passe o cursor sobre o mapa'}
      </div>
      <MapContext.Provider value={map}>{children}</MapContext.Provider>
    </div>
  );
}
