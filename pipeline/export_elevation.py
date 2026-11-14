"""Recorta o DTM HiRISE de Jezero e gera elevation.bin (issue #24).

Le o GeoTIFF por janela (nunca o arquivo inteiro), reamostra por media de
blocos para a grade de web/public/data/meta.json (512x512, lon/lat) e grava:

    web/public/data/elevation.bin   Float32 little-endian, row-major, linha 0 = norte
    web/public/data/meta.json       mesmo conteudo da #23

Uso (a partir da raiz do repositorio):
    pipeline/.venv/Scripts/python pipeline/export_elevation.py [caminho_do_dtm.tif]

Decisoes:
- O DTM e uma grade Equirectangular com paralelo padrao 0: x = R*lon e y = R*lat
  (R = 3.396.190 m), ou seja, ja e uma grade lon/lat com longitude -180..180 positiva
  a leste. Reamostrar para o grid do app e so uma media de blocos, sem reprojetar.
- Reamostragem por media (Resampling.average): preserva o relevo medio de cada celula.
- nodata: o do DTM (-3.4028226550889045e+38) vira o do contrato (menor float32). Uma
  celula do grid e nodata se QUALQUER pixel de 1 m dentro dela era nodata. Nunca vira 0.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject
from rasterio.windows import Window

from jezero_grid import (
    BBOX,
    DTM_RADIUS_M,
    ELEVATION_PATH,
    HEIGHT,
    NODATA,
    WIDTH,
    write_meta,
)

DEFAULT_DTM = Path("data/raw/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif")
NODATA_F32 = np.float32(NODATA)


def lonlat_to_xy(lon: float, lat: float) -> tuple[float, float]:
    """lon/lat (graus) para metros da projecao Equirectangular do DTM."""
    return DTM_RADIUS_M * math.radians(lon), DTM_RADIUS_M * math.radians(lat)


def resample_to_grid(
    dtm: Path,
    bbox: tuple[float, float, float, float] = BBOX,
    width: int = WIDTH,
    height: int = HEIGHT,
) -> np.ndarray:
    """Devolve o grid (height, width) float32, linha 0 = norte, nodata = NODATA."""
    min_lon, min_lat, max_lon, max_lat = bbox
    west, south = lonlat_to_xy(min_lon, min_lat)
    east, north = lonlat_to_xy(max_lon, max_lat)

    with rasterio.open(dtm) as ds:
        # Janela do DTM que cobre o bbox, com 2 pixels de folga.
        col0 = max(0, int(math.floor(west - ds.bounds.left)) - 2)
        col1 = min(ds.width, int(math.ceil(east - ds.bounds.left)) + 2)
        row0 = max(0, int(math.floor(ds.bounds.top - north)) - 2)
        row1 = min(ds.height, int(math.ceil(ds.bounds.top - south)) + 2)
        window = Window(col0, row0, col1 - col0, row1 - row0)
        if (west < ds.bounds.left or east > ds.bounds.right
                or south < ds.bounds.bottom or north > ds.bounds.top):
            raise ValueError("bbox fora da cobertura do DTM")

        masked = ds.read(1, window=window, masked=True)
        win_transform = ds.window_transform(window)
        crs = ds.crs

    nodata_src = np.ma.getmaskarray(masked)
    values = masked.filled(NODATA_F32).astype(np.float32)
    dst_transform = from_bounds(west, south, east, north, width, height)

    elevation = np.full((height, width), NODATA_F32, dtype=np.float32)
    reproject(
        source=values,
        destination=elevation,
        src_transform=win_transform,
        src_crs=crs,
        src_nodata=float(NODATA_F32),
        dst_transform=dst_transform,
        dst_crs=crs,
        dst_nodata=float(NODATA_F32),
        resampling=Resampling.average,
    )

    # Fracao de pixels nodata em cada celula: qualquer buraco vira nodata.
    hole_fraction = np.zeros((height, width), dtype=np.float32)
    reproject(
        source=nodata_src.astype(np.float32),
        destination=hole_fraction,
        src_transform=win_transform,
        src_crs=crs,
        dst_transform=dst_transform,
        dst_crs=crs,
        resampling=Resampling.average,
    )
    elevation[hole_fraction > 0] = NODATA_F32
    return elevation


def export(dtm: Path = DEFAULT_DTM, out: Path = ELEVATION_PATH) -> np.ndarray:
    grid = resample_to_grid(dtm)
    out.parent.mkdir(parents=True, exist_ok=True)
    grid.astype("<f4").tofile(out)
    write_meta()
    return grid


def main() -> None:
    dtm = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DTM
    if not dtm.exists():
        raise SystemExit(f"DTM nao encontrado: {dtm}\nBaixe conforme docs/dados-relevo.md.")
    grid = export(dtm)
    valid = grid != NODATA_F32
    print(f"gravado {ELEVATION_PATH} ({ELEVATION_PATH.stat().st_size} bytes, {WIDTH}x{HEIGHT} float32 little-endian)")
    print(f"celulas validas: {int(valid.sum())} de {grid.size}; nodata: {int((~valid).sum())}")
    print(f"elevacao: min={grid[valid].min():.2f} max={grid[valid].max():.2f} media={grid[valid].mean():.2f} m")


if __name__ == "__main__":
    main()
