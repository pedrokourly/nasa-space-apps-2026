/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCrism } from './loadData';

const dir = new URL('../../public/data/', import.meta.url);
const crism = parseCrism(JSON.parse(readFileSync(new URL('crism.json', dir), 'utf8')));
const png = readFileSync(new URL('crism.png', dir));

describe('real crism.json + crism.png (issue #64)', () => {
  it('is the real CRISM product, not the mock', () => {
    expect(crism.mock).toBeFalsy();
    expect(crism.product_id).toBe('FRT00005C5E_07_BRCARJ_MTR3');
    expect(crism.acquired).toBe('2007-05-19');
  });

  it('covers the Jezero delta, inside the Jezero view, in −180..180', () => {
    const [w, s, e, n] = crism.bbox;
    expect(w).toBeLessThan(77.43);
    expect(e).toBeGreaterThan(77.43);
    expect(s).toBeLessThan(18.46);
    expect(n).toBeGreaterThan(18.46);
    for (const lon of [w, e]) expect(lon).toBeGreaterThan(77.05);
    for (const lon of [w, e]) expect(lon).toBeLessThan(78.05);
    for (const lat of [s, n]) expect(lat).toBeGreaterThan(17.95);
    for (const lat of [s, n]) expect(lat).toBeLessThan(18.9);
  });

  it('is an RGBA PNG of the product size (890 × 891)', () => {
    expect(png.readUInt32BE(0)).toBe(0x89504e47);
    expect(png.readUInt32BE(16)).toBe(890);
    expect(png.readUInt32BE(20)).toBe(891);
    expect(png[25]).toBe(6); // color type 6 = RGBA
  });
});
