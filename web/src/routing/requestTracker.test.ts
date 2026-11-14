import { describe, expect, it } from 'vitest';
import { RequestTracker } from './requestTracker';

describe('RequestTracker', () => {
  it('ids grow and only the last one is current', () => {
    const t = new RequestTracker();
    const a = t.next();
    expect(t.isCurrent(a)).toBe(true);
    const b = t.next();
    expect(b).toBeGreaterThan(a);
    expect(t.isCurrent(a)).toBe(false);
    expect(t.isCurrent(b)).toBe(true);
  });

  it('no id is current before the first request', () => {
    expect(new RequestTracker().isCurrent(1)).toBe(false);
  });
});
