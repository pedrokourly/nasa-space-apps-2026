"""Compute the slope of elevation.bin and build slope.bin (issue #25).

Reads web/public/data/elevation.bin and meta.json and writes, on the SAME grid:

    web/public/data/slope.bin   Float32 little-endian, row-major, row 0 = north, in degrees

Method (assumption recorded in docs/terrain-data.md):
- Horn slope (the same as `gdaldem slope`) on the 512x512 grid, using the real meters per
  cell in x and y from meta.json: dz/dx and dz/dy from a weighted 3x3 kernel,
  slope = degrees(arctan(hypot(dz/dx, dz/dy))).
- A cell only has a value if all 9 cells of the kernel are valid. So a nodata cell
  contaminates its 8 neighbours, and the 1-cell border of the grid is nodata (no neighbours).
- nodata = the one in meta.json. It never becomes 0.

Usage (from the repository root):
    pipeline/.venv/Scripts/python pipeline/export_slope.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from jezero_grid import ELEVATION_PATH, META_PATH

SLOPE_PATH = Path("web/public/data/slope.bin")


def horn_slope(z: np.ndarray, dx: float, dy: float, nodata: float) -> np.ndarray:
    """Slope in degrees (float32) using the Horn kernel.

    z: grid (rows x columns), row 0 = north. dx, dy: real meters per cell in x and y.
    """
    if z.ndim != 2 or min(z.shape) < 3:
        raise ValueError("the grid needs at least 3x3 cells")
    nd = np.float32(nodata)
    invalid = (z == nd) | ~np.isfinite(z)
    zz = np.where(invalid, 0.0, z).astype(np.float64)

    a, b, c = zz[:-2, :-2], zz[:-2, 1:-1], zz[:-2, 2:]
    d, f = zz[1:-1, :-2], zz[1:-1, 2:]
    g, h, i = zz[2:, :-2], zz[2:, 1:-1], zz[2:, 2:]
    dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8.0 * dx)
    dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8.0 * dy)
    inner_slope = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))

    # Any nodata cell inside the 3x3 kernel invalidates the result.
    bad = np.zeros_like(inner_slope, dtype=bool)
    for r in range(3):
        for col in range(3):
            bad |= invalid[r : r + inner_slope.shape[0], col : col + inner_slope.shape[1]]

    out = np.full(z.shape, nd, dtype=np.float32)
    inner = out[1:-1, 1:-1]
    inner[:] = inner_slope.astype(np.float32)
    inner[bad] = nd
    return out


def export(elevation: Path = ELEVATION_PATH, meta_path: Path = META_PATH, out: Path = SLOPE_PATH) -> np.ndarray:
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    w, h = meta["width"], meta["height"]
    expected = w * h * 4
    if elevation.stat().st_size != expected:
        raise ValueError(f"{elevation} has {elevation.stat().st_size} bytes, expected {expected}")
    z = np.fromfile(elevation, dtype="<f4").reshape(h, w)
    slope = horn_slope(z, meta["m_per_cell_x"], meta["m_per_cell_y"], meta["nodata"])
    out.parent.mkdir(parents=True, exist_ok=True)
    slope.astype("<f4").tofile(out)
    return slope


def main() -> None:
    meta = json.loads(META_PATH.read_text(encoding="utf-8"))
    slope = export()
    nd = np.float32(meta["nodata"])
    valid = slope != nd
    print(f"wrote {SLOPE_PATH} ({SLOPE_PATH.stat().st_size} bytes, {meta['width']}x{meta['height']} float32 little-endian)")
    print(f"valid cells: {int(valid.sum())} of {slope.size}; nodata: {int((~valid).sum())} (1-cell border = {2 * (meta['width'] + meta['height']) - 4})")
    v = slope[valid]
    print(f"slope: min={v.min():.2f} max={v.max():.2f} mean={v.mean():.2f} median={np.median(v):.2f} degrees")
    for t in (10, 15, 25):
        print(f"  > {t} degrees: {100 * (v > t).mean():.2f}% of the valid cells")


if __name__ == "__main__":
    main()
