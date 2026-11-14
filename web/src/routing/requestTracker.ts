/** Tracks increasing request ids: only the latest request is "current" (latest wins). */
export class RequestTracker {
  private last = 0;

  /** Registers a new request and returns its id. */
  next(): number {
    this.last += 1;
    return this.last;
  }

  /** True if `id` is the most recent request. */
  isCurrent(id: number): boolean {
    return id === this.last;
  }
}
