"""Crop the Jezero HiRISE DTM and build elevation.bin (issue #24).

Reads the GeoTIFF by window (never the whole file), resamples by block average to the
web/public/data/meta.json grid (512x512, lon/lat) and writes:

    web/public/data/elevation.bin   Float32 little-endian, row-major, row 0 = north
    web/public/data/meta.json       same content as #23

Usage (from the repository root):
    pipeline/.venv/Scripts/python pipeline/export_elevation.py [path_to_dtm.tif]

Decisions:
- The DTM is an Equirectangular grid with standard parallel 0: x = R*lon and y = R*lat
  (R = 3,396,190 m), so it already is a lon/lat grid with longitude -180..180 positive
  east. Resampling to the app grid is just a block average, with no reprojection.
- Resampling by average (Resampling.average) keeps the mean relief of each cell.
- nodata: the DTM one (-3.4028226550889045e+38) becomes the contract one (lowest float32).
  A grid cell is nodata if ANY 1 m pixel inside it was nodata. It never becomes 0.
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
    """lon/lat (degrees) to meters of the DTM Equirectangular projection."""
    return DTM_RADIUS_M * math.radians(lon), DTM_RADIUS_M * math.radians(lat)


def resample_to_grid(
    dtm: Path,
    bbox: tuple[float, float, float, float] = BBOX,
    width: int = WIDTH,
    height: int = HEIGHT,
) -> np.ndarray:
    """Return the (height, width) float32 grid, row 0 = north, nodata = NODATA."""
    min_lon, min_lat, max_lon, max_lat = bbox
    west, south = lonlat_to_xy(min_lon, min_lat)
    east, north = lonlat_to_xy(max_lon, max_lat)

    with rasterio.open(dtm) as ds:
        # DTM window covering the bbox, with a 2 pixel margin.
        col0 = max(0, int(math.floor(west - ds.bounds.left)) - 2)
        col1 = min(ds.width, int(math.ceil(east - ds.bounds.left)) + 2)
        row0 = max(0, int(math.floor(ds.bounds.top - north)) - 2)
        row1 = min(ds.height, int(math.ceil(ds.bounds.top - south)) + 2)
        window = Window(col0, row0, col1 - col0, row1 - row0)
        if (west < ds.bounds.left or east > ds.bounds.right
                or south < ds.bounds.bottom or north > ds.bounds.top):
            raise ValueError("bbox outside the DTM coverage")

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

    # Fraction of nodata pixels in each cell: any hole makes the cell nodata.
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
        raise SystemExit(f"DTM not found: {dtm}\nDownload it as described in docs/terrain-data.md.")
    grid = export(dtm)
    valid = grid != NODATA_F32
    print(f"wrote {ELEVATION_PATH} ({ELEVATION_PATH.stat().st_size} bytes, {WIDTH}x{HEIGHT} float32 little-endian)")
    print(f"valid cells: {int(valid.sum())} of {grid.size}; nodata: {int((~valid).sum())}")
    print(f"elevation: min={grid[valid].min():.2f} max={grid[valid].max():.2f} mean={grid[valid].mean():.2f} m")


if __name__ == "__main__":
    main()
