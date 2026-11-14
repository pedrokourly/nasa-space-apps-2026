import { describe, expect, it } from 'vitest';
import { decodeFloat32LE, encodeFloat32LE, gridFromBuffers } from './gridBinary';
import { mockMeta } from './mockGrid';

const buf = (values: number[]) => encodeFloat32LE(new Float32Array(values)).buffer as ArrayBuffer;

describe('Float32 LE files', () => {
  it('round trip keeps the values, nodata included', () => {
    const values = [0, -2500.5, 12.25, -3.4028234663852886e38, 40];
    expect(Array.from(decodeFloat32LE(buf(values), values.length, 'x'))).toEqual(Array.from(new Float32Array(values)));
  });

  it('is little-endian regardless of the machine', () => {
    // 1.0 in Float32 LE = 00 00 80 3F
    expect(Array.from(encodeFloat32LE(new Float32Array([1])))).toEqual([0x00, 0x00, 0x80, 0x3f]);
  });

  it('rejects a file with the wrong byte size', () => {
    expect(() => decodeFloat32LE(new ArrayBuffer(10), 3, 'elevation.bin')).toThrow(/elevation\.bin has 10 bytes; expected 12/);
  });
});

describe('gridFromBuffers', () => {
  const meta = mockMeta(3, 2);
  const six = [1, 2, 3, 4, 5, 6];

  it('builds the grid in row-major order', () => {
    const g = gridFromBuffers(meta, buf(six), buf(six.map((v) => v * 10)));
    expect(g.elevation[5]).toBe(6);
    expect(g.slope[0]).toBe(10);
  });

  it('reads the optional sand layer only when meta.sand_layer is true', () => {
    const sand = new Uint8Array([0, 1, 0, 0, 1, 1]).buffer;
    const g = gridFromBuffers({ ...meta, sand_layer: true }, buf(six), buf(six), sand);
    expect(Array.from(g.sand!)).toEqual([0, 1, 0, 0, 1, 1]);
    expect(gridFromBuffers(meta, buf(six), buf(six)).sand).toBeUndefined();
    expect(() => gridFromBuffers({ ...meta, sand_layer: true }, buf(six), buf(six))).toThrow(/sand\.bin is missing/);
    expect(() => gridFromBuffers(meta, buf(six), buf(six), sand)).toThrow(/sand_layer/);
  });

  it('rejects a sand layer with a wrong size or values other than 0 and 1', () => {
    const m = { ...meta, sand_layer: true };
    expect(() => gridFromBuffers(m, buf(six), buf(six), new Uint8Array(5).buffer)).toThrow(/sand\.bin has 5 bytes/);
    expect(() => gridFromBuffers(m, buf(six), buf(six), new Uint8Array([0, 0, 2, 0, 0, 0]).buffer)).toThrow(/value 2/);
  });

  it('rejects an inverted bbox, a zero cell size or a size mismatch', () => {
    expect(() => gridFromBuffers({ ...meta, bbox: [78, 18, 77, 19] }, buf(six), buf(six))).toThrow(/bbox/);
    expect(() => gridFromBuffers({ ...meta, m_per_cell_x: 0 }, buf(six), buf(six))).toThrow(/m_per_cell/);
    expect(() => gridFromBuffers(meta, buf([1, 2]), buf(six))).toThrow(/elevation\.bin/);
  });
});
