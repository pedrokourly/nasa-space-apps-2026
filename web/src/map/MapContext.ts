import { createContext, useContext } from 'react';
import type L from 'leaflet';

/**
 * Instância do mapa Leaflet. É `null` até o mapa ser criado no `useEffect` do
 * `MapView`. Componentes que adicionam camadas, alvos ou rota devem ficar como
 * filhos de `<MapView>` e ler o mapa com `useMap()`.
 */
export const MapContext = createContext<L.Map | null>(null);

/** Devolve o mapa Leaflet, ou `null` enquanto ele ainda não foi criado. */
export function useMap(): L.Map | null {
  return useContext(MapContext);
}
