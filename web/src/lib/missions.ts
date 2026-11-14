import type { Mission } from '../types/contract';

/** Finds the mission by `id`; `undefined` if missing (the UI shows "Mission not found"). */
export function findMission(missions: readonly Mission[], id: string): Mission | undefined {
  return missions.find((m) => m.id === id);
}
