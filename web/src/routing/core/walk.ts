/**
 * Modelo de caminhada e consumo de O₂ por trecho.
 *
 * REFERÊNCIA (velocidade): função de caminhada de Tobler (1993), `v = 6·exp(−3,5·|S + 0,05|)` km/h,
 * com S = tan(inclinação) com sinal. Aqui é normalizada para que o plano valha `speedFlatMS`.
 *
 * SUPOSIÇÕES (sem referência científica, a calibrar e citar quando houver fonte):
 * - `speedFlatMS`: velocidade de um astronauta de traje no plano.
 * - `o2BaseKgPerH`: consumo de O₂ andando no plano.
 * - `o2UphillGain`: quanto o subir aumenta o consumo (por unidade de gradiente).
 * - `minSpeedMS`: piso de velocidade, para nunca dividir por quase zero.
 * - A gravidade de Marte (0,38 g) não é modelada.
 */

export interface WalkProfile {
  /** SUPOSIÇÃO: velocidade no plano (m/s). */
  speedFlatMS: number;
  /** Piso de velocidade (m/s). */
  minSpeedMS: number;
  /** SUPOSIÇÃO: consumo de O₂ no plano (kg por hora). */
  o2BaseKgPerH: number;
  /** SUPOSIÇÃO: acréscimo relativo de consumo por unidade de gradiente de subida (rise/run). */
  o2UphillGain: number;
}

export const DEFAULT_WALK: WalkProfile = {
  speedFlatMS: 1.0,
  minSpeedMS: 0.1,
  o2BaseKgPerH: 0.1,
  o2UphillGain: 4,
};

/** SUPOSIÇÃO: O₂ disponível na saída (kg), cerca de 10 h de caminhada no plano. */
export const DEFAULT_O2_AVAILABLE_KG = 1.0;

/** Velocidade (m/s) para um gradiente `grade` = subida/avanço, com sinal (positivo = subindo). */
export function walkingSpeed(grade: number, walk: WalkProfile = DEFAULT_WALK): number {
  const v = walk.speedFlatMS * Math.exp(-3.5 * (Math.abs(grade + 0.05) - 0.05));
  return Math.max(v, walk.minSpeedMS);
}

/** Tempo e O₂ para andar `distM` metros (horizontais) com variação de elevação `deltaElevM`. */
export function segmentCost(
  distM: number,
  deltaElevM: number,
  walk: WalkProfile = DEFAULT_WALK,
): { time_s: number; o2_kg: number } {
  if (distM <= 0) return { time_s: 0, o2_kg: 0 };
  const grade = deltaElevM / distM;
  const time_s = distM / walkingSpeed(grade, walk);
  const rateKgPerS = (walk.o2BaseKgPerH / 3600) * (1 + walk.o2UphillGain * Math.max(0, grade));
  return { time_s, o2_kg: time_s * rateKgPerS };
}
