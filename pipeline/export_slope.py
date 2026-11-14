"""Calcula a declividade do elevation.bin e gera slope.bin (issue #25).

Le web/public/data/elevation.bin e meta.json e grava, no MESMO grid:

    web/public/data/slope.bin   Float32 little-endian, row-major, linha 0 = norte, em graus

Metodo (suposicao registrada em docs/dados-relevo.md):
- Declividade de Horn (a mesma do `gdaldem slope`) sobre o grid de 512x512, com os
  metros reais por celula em x e y do meta.json: dz/dx e dz/dy por kernel 3x3 ponderado,
  slope = degrees(arctan(hypot(dz/dx, dz/dy))).
- A celula so tem valor se as 9 celulas do kernel forem validas. Logo, uma celula nodata
  contamina as 8 vizinhas, e a borda de 1 celula do grid fica nodata (sem vizinhos).
- nodata = o do meta.json. Nunca vira 0.

Uso (a partir da raiz do repositorio):
    pipeline/.venv/Scripts/python pipeline/export_slope.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from jezero_grid import ELEVATION_PATH, META_PATH

SLOPE_PATH = Path("web/public/data/slope.bin")


def horn_slope(z: np.ndarray, dx: float, dy: float, nodata: float) -> np.ndarray:
    """Declividade em graus (float32) pelo kernel de Horn.

    z: grade (linhas x colunas), linha 0 = norte. dx, dy: metros reais por celula em x e y.
    """
    if z.ndim != 2 or min(z.shape) < 3:
        raise ValueError("a grade precisa ter ao menos 3x3 celulas")
    nd = np.float32(nodata)
    invalid = (z == nd) | ~np.isfinite(z)
    zz = np.where(invalid, 0.0, z).astype(np.float64)

    a, b, c = zz[:-2, :-2], zz[:-2, 1:-1], zz[:-2, 2:]
    d, f = zz[1:-1, :-2], zz[1:-1, 2:]
    g, h, i = zz[2:, :-2], zz[2:, 1:-1], zz[2:, 2:]
    dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8.0 * dx)
    dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8.0 * dy)
    inner_slope = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))

    # Qualquer celula nodata no kernel 3x3 invalida o resultado.
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
        raise ValueError(f"{elevation} tem {elevation.stat().st_size} bytes, esperado {expected}")
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
    print(f"gravado {SLOPE_PATH} ({SLOPE_PATH.stat().st_size} bytes, {meta['width']}x{meta['height']} float32 little-endian)")
    print(f"celulas validas: {int(valid.sum())} de {slope.size}; nodata: {int((~valid).sum())} (borda de 1 celula = {2 * (meta['width'] + meta['height']) - 4})")
    v = slope[valid]
    print(f"declividade: min={v.min():.2f} max={v.max():.2f} media={v.mean():.2f} mediana={np.median(v):.2f} graus")
    for t in (10, 15, 25):
        print(f"  > {t} graus: {100 * (v > t).mean():.2f}% das celulas validas")


if __name__ == "__main__":
    main()
