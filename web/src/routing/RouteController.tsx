import { useRouting } from './useRouting';

/** Componente sem UI que liga `waypoints` do store ao Worker de rota. */
export default function RouteController() {
  useRouting();
  return null;
}
