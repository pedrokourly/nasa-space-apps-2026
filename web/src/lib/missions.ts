import type { Mission } from '../types/contract';

/** Procura a missão pelo `id`; `undefined` se não existir (a UI mostra "Missão não encontrada"). */
export function findMission(missions: readonly Mission[], id: string): Mission | undefined {
  return missions.find((m) => m.id === id);
}
