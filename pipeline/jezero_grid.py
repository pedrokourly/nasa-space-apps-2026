"""Jezero grid geometry (issue #23): bbox, grid size and meta.json.

Single source of the grid constants. The next scripts (#24 elevation.bin, #25 slope.bin)
import from here so they all use the same geometry.

Usage (from the repository root):
    pipeline/.venv/Scripts/python pipeline/jezero_grid.py            # writes web/public/data/meta.json
    pipeline/.venv/Scripts/python pipeline/jezero_grid.py --check    # only validates, writes nothing
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np

# Mean radius of Mars used by the app (web/src/lib/mars-geo.ts). Every distance in the
# contract uses this radius, not the one of the DTM projection (3,396,190 m).
MARS_RADIUS_APP_M = 3_389_500.0

# [minLon, minLat, maxLon, maxLat], longitude -180..180, positive east.
# Extended west (from 77.36) to include the Margin Unit samples; the mock targets and route still fall inside.
BBOX = (77.32, 18.40, 77.50, 18.50)

WIDTH = 512
HEIGHT = 512

# Lowest finite float32. It is the mock nodata; the source DTM uses another value
# (-3.4028226550889045e+38), so the pipeline normalizes to this one when writing the .bin files.
NODATA = float(np.finfo(np.float32).min)

# HiRISE DTM coverage (docs/terrain-data.md): lon 77.2229..77.5840 and lat 18.3068..18.6693.
DTM_BBOX = (77.2229, 18.3068, 77.5840, 18.6693)

SOURCE = (
    "USGS Astrogeology Science Center, Mars 2020 TRN HiRISE DTM Mosaic (MRO/HiRISE, 1 m, "
    "published 2020-07-24, DOI 10.5066/P9REJ9JN), resampled to a 512x512 lon/lat grid"
)

META_PATH = Path("web/public/data/meta.json")
ELEVATION_PATH = Path("web/public/data/elevation.bin")

# Radius of the Mars sphere in the DTM projection (Equirectangular, standard parallel 0):
# x = R * lon (rad) and y = R * lat (rad). It is not the app radius (MARS_RADIUS_APP_M).
DTM_RADIUS_M = 3_396_190.0


def haversine(a: tuple[float, float], b: tuple[float, float], radius: float = MARS_RADIUS_APP_M) -> float:
    """Distance in meters between two (lon, lat) points, same as haversine in web/src/lib/mars-geo.ts."""
    lon_a, lat_a = a
    lon_b, lat_b = b
    phi1, phi2 = math.radians(lat_a), math.radians(lat_b)
    d_phi = math.radians(lat_b - lat_a)
    d_lambda = math.radians(lon_b - lon_a)
    h = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    h = min(1.0, max(0.0, h))
    return radius * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h))


def bbox_sides_m(bbox: tuple[float, float, float, float] = BBOX) -> tuple[float, float]:
    """Width (at the central latitude) and height of the bbox in meters, using the app haversine."""
    min_lon, min_lat, max_lon, max_lat = bbox
    mid_lat = (min_lat + max_lat) / 2
    return haversine((min_lon, mid_lat), (max_lon, mid_lat)), haversine((min_lon, min_lat), (min_lon, max_lat))


def build_meta() -> dict:
    """Build the meta.json in the contract format (AGENTS.md, section 5)."""
    width_m, height_m = bbox_sides_m()
    return {
        "bbox": list(BBOX),
        "width": WIDTH,
        "height": HEIGHT,
        "m_per_cell_x": round(width_m / WIDTH, 3),
        "m_per_cell_y": round(height_m / HEIGHT, 3),
        "lon_convention": "-180..180",
        "nodata": NODATA,
        "crs": "EPSG:4326",
        "row0": "north",
        "dtype": "float32le",
        "source": SOURCE,
    }


def write_meta(path: Path = META_PATH) -> dict:
    """Write the contract meta.json and return its content."""
    meta = build_meta()
    path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return meta


def bbox_inside(inner: tuple[float, float, float, float], outer: tuple[float, float, float, float]) -> bool:
    return inner[0] >= outer[0] and inner[1] >= outer[1] and inner[2] <= outer[2] and inner[3] <= outer[3]


def dtm_nodata_percent(tif: Path, bbox: tuple[float, float, float, float] = BBOX) -> float:
    """Percentage of DTM nodata pixels inside the bbox (decimated read)."""
    import rasterio
    from rasterio.windows import Window

    r_dtm = DTM_RADIUS_M
    with rasterio.open(tif) as ds:
        left, top = ds.bounds.left, ds.bounds.top
        c0 = int(r_dtm * math.radians(bbox[0]) - left)
        c1 = math.ceil(r_dtm * math.radians(bbox[2]) - left)
        r0 = int(top - r_dtm * math.radians(bbox[3]))
        r1 = math.ceil(top - r_dtm * math.radians(bbox[1]))
        arr = ds.read(
            1,
            window=Window(c0, r0, c1 - c0, r1 - r0),
            masked=True,
            out_shape=((r1 - r0) // 8, (c1 - c0) // 8),
        )
    return float(np.ma.getmaskarray(arr).mean() * 100)


def main() -> None:
    check_only = "--check" in sys.argv
    meta = build_meta()
    width_m, height_m = bbox_sides_m()
    print(f"bbox {BBOX}: {width_m / 1000:.2f} km x {height_m / 1000:.2f} km (haversine, R = 3389.5 km)")
    print(f"grid {WIDTH}x{HEIGHT}: {meta['m_per_cell_x']} m/cell in x, {meta['m_per_cell_y']} m/cell in y")
    assert 5000 < width_m < 15000 and 5000 < height_m < 15000, "bbox side outside 5 to 15 km"
    assert bbox_inside(BBOX, DTM_BBOX), "bbox outside the DTM coverage"
    print("bbox sides between 5 and 15 km and inside the DTM coverage")

    tifs = sorted(Path("data/raw").glob("JEZ_hirise_soc_006_DTM_*.tif"))
    if tifs:
        print(f"DTM nodata inside the bbox: {dtm_nodata_percent(tifs[0]):.2f}%")

    if check_only:
        return
    write_meta()
    print(f"wrote {META_PATH}")


if __name__ == "__main__":
    main()
