import { describe, expect, it } from 'vitest';
import { formatDistance, formatElapsed } from './simulationFormat';

describe('simulation formatting', () => {
  it('formats elapsed time as h:mm', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(59)).toBe('0:00');
    expect(formatElapsed(3600 + 5 * 60 + 30)).toBe('1:05');
    expect(formatElapsed(-10)).toBe('0:00');
  });

  it('formats distance in m or km', () => {
    expect(formatDistance(842.4)).toBe('842 m');
    expect(formatDistance(1234)).toBe('1.23 km');
  });
});
