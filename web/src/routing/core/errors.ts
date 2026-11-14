/** Erros do núcleo de roteamento. Sem dependências; o Worker os traduz em estados da UI. */

/** Não existe caminho possível entre dois pontos (obstáculos, sem dado ou ilha). */
export class NoPathError extends Error {
  constructor(message = 'Sem caminho possível entre os pontos') {
    super(message);
    this.name = 'NoPathError';
  }
}

/** Um ponto pedido está fora do grid (`bbox`) carregado. */
export class OutOfGridError extends Error {
  readonly point: [lon: number, lat: number];
  constructor(point: [lon: number, lat: number]) {
    super(`Ponto fora do grid: [${point[0]}, ${point[1]}]`);
    this.name = 'OutOfGridError';
    this.point = point;
  }
}
