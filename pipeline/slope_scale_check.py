"""Compara escalas de declividade (issue #25): grid de ~15 m x DTM de 1 m agregado por celula.

Evidencia da decisao registrada em docs/dados-relevo.md. Nao gera arquivo do app.

Uso (a partir da raiz do repositorio):
    pipeline/.venv/Scripts/python pipeline/slope_scale_check.py [caminho_do_dtm.tif]
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject
from rasterio.windows import Window

from export_elevation import DEFAULT_DTM, lonlat_to_xy
from export_slope import SLOPE_PATH, horn_slope
from jezero_grid import BBOX, HEIGHT, META_PATH, NODATA, WIDTH

NODATA_F32 = np.float32(NODATA)


def slope_1m(dtm: Path, strip: int = 500) -> tuple[np.ndarray, "rasterio.Affine", object]:
    """Declividade de Horn sobre o DTM de 1 m dentro do bbox, em faixas de linhas."""
    west, south = lonlat_to_xy(BBOX[0], BBOX[1])
    east, north = lonlat_to_xy(BBOX[2], BBOX[3])
    with rasterio.open(dtm) as ds:
        col0 = int(math.floor(west - ds.bounds.left)) - 2
        col1 = int(math.ceil(east - ds.bounds.left)) + 2
        row0 = int(math.floor(ds.bounds.top - north)) - 2
        row1 = int(math.ceil(ds.bounds.top - south)) + 2
        window = Window(col0, row0, col1 - col0, row1 - row0)
        z = ds.read(1, window=window, masked=True).filled(NODATA_F32).astype(np.float32)
        transform, crs = ds.window_transform(window), ds.crs

    mid_lat = (BBOX[1] + BBOX[3]) / 2
    dx, dy = math.cos(math.radians(mid_lat)), 1.0  # metros no solo por pixel de 1 m (projecao Equirectangular)
    out = np.full(z.shape, NODATA_F32, dtype=np.float32)
    for r in range(0, z.shape[0], strip):
        lo, hi = max(0, r - 1), min(z.shape[0], r + strip + 1)
        s = horn_slope(z[lo:hi], dx, dy, NODATA)
        a, b = r - lo, r - lo + min(strip, z.shape[0] - r)
        out[r : r + (b - a)] = s[a:b]
    return out, transform, crs


def to_grid(field: np.ndarray, transform, crs, method: Resampling) -> np.ndarray:
    west, south = lonlat_to_xy(BBOX[0], BBOX[1])
    east, north = lonlat_to_xy(BBOX[2], BBOX[3])
    dst = np.full((HEIGHT, WIDTH), NODATA_F32, dtype=np.float32)
    reproject(
        source=field, destination=dst, src_transform=transform, src_crs=crs, src_nodata=float(NODATA_F32),
        dst_transform=from_bounds(west, south, east, north, WIDTH, HEIGHT), dst_crs=crs,
        dst_nodata=float(NODATA_F32), resampling=method,
    )
    return dst


def summary(name: str, s: np.ndarray, ref: np.ndarray | None = None) -> None:
    ok = s != NODATA_F32
    v = s[ok]
    line = f"{name:34s} media={v.mean():5.2f}  mediana={np.median(v):5.2f}  max={v.max():5.2f}"
    line += "".join(f"  >{t}={100 * (v > t).mean():5.2f}%" for t in (10, 15, 25))
    if ref is not None:
        both = ok & (ref != NODATA_F32)
        line += f"  corr={np.corrcoef(s[both], ref[both])[0, 1]:.3f}"
    print(line)


def main() -> None:
    dtm = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DTM
    meta = json.loads(META_PATH.read_text(encoding="utf-8"))
    grid_scale = np.fromfile(SLOPE_PATH, dtype="<f4").reshape(meta["height"], meta["width"])
    field, transform, crs = slope_1m(dtm)
    px = field != NODATA_F32
    v1 = field[px]
    print(f"declividade em pixels de 1 m (bbox): n={v1.size}  media={v1.mean():.2f}  mediana={np.median(v1):.2f}  "
          f"max={v1.max():.2f}  >25 graus={100 * (v1 > 25).mean():.2f}%  >45 graus={100 * (v1 > 45).mean():.2f}%")
    print("celulas do grid de 512x512 (mesmas celulas do slope.bin):")
    summary("A) grid ~15 m (slope.bin)", grid_scale)
    summary("B) 1 m, media por celula", to_grid(field, transform, crs, Resampling.average), grid_scale)
    summary("C) 1 m, maximo por celula", to_grid(field, transform, crs, Resampling.max), grid_scale)


if __name__ == "__main__":
    main()
