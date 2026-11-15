/**
 * Binary min-heap of (node, priority) pairs on typed arrays (grows as needed). Stale entries are
 * skipped by the caller when popped (lazy deletion). Used by A*, Dijkstra and the return field.
 */
export class MinHeap {
  private nodes: Int32Array;
  private keys: Float64Array;
  private n = 0;

  constructor(capacity = 1024) {
    this.nodes = new Int32Array(capacity);
    this.keys = new Float64Array(capacity);
  }

  get size(): number {
    return this.n;
  }

  push(node: number, key: number): void {
    if (this.n === this.nodes.length) {
      const nodes = new Int32Array(this.n * 2);
      const keys = new Float64Array(this.n * 2);
      nodes.set(this.nodes);
      keys.set(this.keys);
      this.nodes = nodes;
      this.keys = keys;
    }
    const nodes = this.nodes;
    const keys = this.keys;
    let i = this.n++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p]! <= key) break;
      nodes[i] = nodes[p]!;
      keys[i] = keys[p]!;
      i = p;
    }
    nodes[i] = node;
    keys[i] = key;
  }

  pop(): number {
    const nodes = this.nodes;
    const keys = this.keys;
    const top = nodes[0]!;
    const n = --this.n;
    if (n > 0) {
      const lastNode = nodes[n]!;
      const lastKey = keys[n]!;
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && keys[c + 1]! < keys[c]!) c++;
        if (keys[c]! >= lastKey) break;
        nodes[i] = nodes[c]!;
        keys[i] = keys[c]!;
        i = c;
      }
      nodes[i] = lastNode;
      keys[i] = lastKey;
    }
    return top;
  }
}
