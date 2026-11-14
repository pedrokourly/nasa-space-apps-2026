import { describe, it, expect } from 'vitest';
import { isInsideBbox, type Bbox } from './bbox';

const bbox: Bbox = [77, 17.5, 78, 18.5];

describe('isInsideBbox', () => {
  it('aceita ponto interno', () => {
    expect(isInsideBbox([77.5, 18], bbox)).toBe(true);
  });
  it('aceita as bordas e os cantos (inclusivo)', () => {
    expect(isInsideBbox([77, 18], bbox)).toBe(true);
    expect(isInsideBbox([78, 18], bbox)).toBe(true);
    expect(isInsideBbox([77.5, 17.5], bbox)).toBe(true);
    expect(isInsideBbox([77.5, 18.5], bbox)).toBe(true);
    expect(isInsideBbox([77, 17.5], bbox)).toBe(true);
    expect(isInsideBbox([78, 18.5], bbox)).toBe(true);
  });
  it('recusa ponto fora em cada lado', () => {
    expect(isInsideBbox([76.99, 18], bbox)).toBe(false);
    expect(isInsideBbox([78.01, 18], bbox)).toBe(false);
    expect(isInsideBbox([77.5, 17.49], bbox)).toBe(false);
    expect(isInsideBbox([77.5, 18.51], bbox)).toBe(false);
  });
});
