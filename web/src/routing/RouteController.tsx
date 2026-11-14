import { useRouting } from './useRouting';

/** UI-less component that connects the store's `waypoints` to the route Worker. */
export default function RouteController() {
  useRouting();
  return null;
}
