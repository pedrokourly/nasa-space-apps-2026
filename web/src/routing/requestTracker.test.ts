import { describe, expect, it } from 'vitest';
import { RequestTracker } from './requestTracker';

describe('RequestTracker', () => {
  it('ids crescem e só o último é atual', () => {
    const t = new RequestTracker();
    const a = t.next();
    expect(t.isCurrent(a)).toBe(true);
    const b = t.next();
    expect(b).toBeGreaterThan(a);
    expect(t.isCurrent(a)).toBe(false);
    expect(t.isCurrent(b)).toBe(true);
  });

  it('nenhum id é atual antes do primeiro pedido', () => {
    expect(new RequestTracker().isCurrent(1)).toBe(false);
  });
});
