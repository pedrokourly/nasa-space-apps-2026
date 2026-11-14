import { describe, it, expect } from 'vitest';
import { bboxSizeM, isInsideBbox, type Bbox } from './bbox';

const bbox: Bbox = [77, 17.5, 78, 18.5];

describe('isInsideBbox', () => {
  it('accepts an inner point', () => {
    expect(isInsideBbox([77.5, 18], bbox)).toBe(true);
  });
  it('accepts edges and corners (inclusive)', () => {
    expect(isInsideBbox([77, 18], bbox)).toBe(true);
    expect(isInsideBbox([78, 18], bbox)).toBe(true);
    expect(isInsideBbox([77.5, 17.5], bbox)).toBe(true);
    expect(isInsideBbox([77.5, 18.5], bbox)).toBe(true);
    expect(isInsideBbox([77, 17.5], bbox)).toBe(true);
    expect(isInsideBbox([78, 18.5], bbox)).toBe(true);
  });
  it('rejects a point outside on each side', () => {
    expect(isInsideBbox([76.99, 18], bbox)).toBe(false);
    expect(isInsideBbox([78.01, 18], bbox)).toBe(false);
    expect(isInsideBbox([77.5, 17.49], bbox)).toBe(false);
    expect(isInsideBbox([77.5, 18.51], bbox)).toBe(false);
  });
});

describe('bboxSizeM', () => {
  const deg = (Math.PI * 3389500) / 180; // meters per degree on Mars
  it('measures height along a meridian', () => {
    expect(bboxSizeM([77, 17.5, 78, 18.5]).heightM).toBeCloseTo(deg, 0);
  });
  it('measures width along the mid-latitude, shrinking with latitude', () => {
    const eq = bboxSizeM([0, -0.5, 1, 0.5]).widthM;
    expect(eq).toBeCloseTo(deg, 0);
    const lat60 = bboxSizeM([0, 59.5, 1, 60.5]).widthM;
    expect(lat60 / eq).toBeCloseTo(0.5, 2);
  });
  it('gives a plausible Jezero-sized area', () => {
    const { widthM, heightM } = bboxSizeM([77.35, 18.4, 77.5, 18.5]);
    expect(widthM).toBeGreaterThan(7000);
    expect(heightM).toBeGreaterThan(5000);
  });
});
