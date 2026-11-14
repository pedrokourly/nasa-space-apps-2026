"""Inspect the Jezero HiRISE DTM (issue #22) and print the findings.

Usage (from the repository root):
    pipeline/.venv/Scripts/python pipeline/inspect_dtm.py [path.tif]

Reads the GeoTIFF metadata and scans the raster in strips of rows (nodata, min/max and the
bbox of the valid pixels). It does not change the file.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling

DEFAULT = Path("data/raw/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif")
APP_RADIUS_M = 3_389_500.0  # Mars radius used by the app (src/lib/mars-geo.ts)


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    with rasterio.open(path) as ds:
        print(f"file: {path.name}")
        print(f"driver: {ds.driver}  size: {ds.width} x {ds.height}  bands: {ds.count}")
        print(f"dtype: {ds.dtypes[0]}  nodata: {ds.nodata}")
        print(f"CRS (WKT):\n{ds.crs.to_wkt() if ds.crs else None}")
        print(f"transform: {ds.transform}")
        print(f"pixel (CRS units): x={ds.res[0]} y={ds.res[1]}")
        print(f"bbox (CRS units): {tuple(ds.bounds)}")
        print(f"tags: {ds.tags()}")
        print(f"band 1 tags: {ds.tags(1)}  description: {ds.descriptions[0]}  unit: {ds.units[0]}")

        # Projection parameters (radius, standard parallel, central meridian).
        crs = ds.crs
        try:
            print(f"PROJ4: {crs.to_proj4()}")
        except Exception as exc:  # pragma: no cover
            print(f"PROJ4 unavailable: {exc}")

        # Quick estimate from a decimated read of min/max/nodata.
        scale = max(ds.width, ds.height) // 2048 or 1
        out_h, out_w = ds.height // scale, ds.width // scale
        arr = ds.read(1, out_shape=(out_h, out_w), resampling=Resampling.nearest, masked=True)
        print(f"sample {out_w}x{out_h}: min={arr.min():.2f} max={arr.max():.2f} m, "
              f"masked pixels (nodata)={int(arr.mask.sum()) if np.ma.is_masked(arr) else 0}")

        # Full scan in strips of rows: nodata, min/max and bbox of the valid pixels.
        total = valid = 0
        vmin, vmax = math.inf, -math.inf
        rmin = rmax = cmin = cmax = None
        step = 512
        for r0 in range(0, ds.height, step):
            h = min(step, ds.height - r0)
            blk = ds.read(1, window=rasterio.windows.Window(0, r0, ds.width, h), masked=True)
            ok = ~np.ma.getmaskarray(blk)
            total += blk.size
            n = int(ok.sum())
            if n:
                valid += n
                vmin = min(vmin, float(blk.min()))
                vmax = max(vmax, float(blk.max()))
                rows = np.flatnonzero(ok.any(axis=1))
                cols = np.flatnonzero(ok.any(axis=0))
                rmin = r0 + int(rows[0]) if rmin is None else rmin
                rmax = r0 + int(rows[-1])
                cmin = int(cols[0]) if cmin is None else min(cmin, int(cols[0]))
                cmax = int(cols[-1]) if cmax is None else max(cmax, int(cols[-1]))
        print(f"FULL SCAN: pixels={total} valid={valid} ({100 * valid / total:.1f}%) "
              f"nodata={total - valid} ({100 * (total - valid) / total:.1f}%)")
        print(f"valid elevation: min={vmin:.2f} max={vmax:.2f} m")
        print(f"bbox of the valid pixels (rows {rmin}-{rmax}, columns {cmin}-{cmax})")

        # Real meters per pixel. In Equirectangular with standard parallel 0,
        # ground_x = pixel * cos(lat); ground_y = pixel. Uses the CRS own radius.
        left, bottom, right, top = ds.bounds
        print(f"extent: {(right - left) / 1000:.2f} km (x) x {(top - bottom) / 1000:.2f} km (y)")
        if crs and crs.is_projected:
            print("the CRS is projected: res is in meters; see the ground meters per pixel by latitude below.")
            from rasterio.warp import transform as warp_transform

            xs = [left, (left + right) / 2, right, (left + right) / 2]
            ys = [(bottom + top) / 2, top, (bottom + top) / 2, bottom]
            lons, lats = warp_transform(crs, crs.geodetic_crs, xs, ys)
            print("lon/lat of the edges (west, north, east, south):")
            for name, lo, la in zip(("west", "north", "east", "south"), lons, lats):
                print(f"  {name}: lon={lo:.5f} lat={la:.5f}")
            lat = math.radians(18.4)
            print(f"cos(18.4 degrees)={math.cos(lat):.5f}; app radius={APP_RADIUS_M} m")
            for name, la in (("south", lats[3]), ("center", (lats[1] + lats[3]) / 2), ("north", lats[1])):
                print(f"  ground m/pixel at lat {la:.4f} ({name}): x={ds.res[0] * math.cos(math.radians(la)):.4f} y={ds.res[1]:.4f}")


if __name__ == "__main__":
    main()
