/** Binary min-heap of (node, priority) pairs. Stale entries are skipped by the caller when popped (lazy deletion). */
export class MinHeap {
  private nodes: number[] = [];
  private keys: number[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(node: number, key: number): void {
    let i = this.nodes.length;
    this.nodes.push(node);
    this.keys.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p]! <= key) break;
      this.nodes[i] = this.nodes[p]!;
      this.keys[i] = this.keys[p]!;
      i = p;
    }
    this.nodes[i] = node;
    this.keys[i] = key;
  }

  pop(): number {
    const top = this.nodes[0]!;
    const lastNode = this.nodes.pop()!;
    const lastKey = this.keys.pop()!;
    const n = this.nodes.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && this.keys[c + 1]! < this.keys[c]!) c++;
        if (this.keys[c]! >= lastKey) break;
        this.nodes[i] = this.nodes[c]!;
        this.keys[i] = this.keys[c]!;
        i = c;
      }
      this.nodes[i] = lastNode;
      this.keys[i] = lastKey;
    }
    return top;
  }
}
