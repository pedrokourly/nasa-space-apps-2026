/** Controla ids crescentes de pedidos: só o último pedido feito é "atual" (último vence). */
export class RequestTracker {
  private last = 0;

  /** Registra um novo pedido e devolve seu id. */
  next(): number {
    this.last += 1;
    return this.last;
  }

  /** Verdadeiro se `id` é o pedido mais recente. */
  isCurrent(id: number): boolean {
    return id === this.last;
  }
}
