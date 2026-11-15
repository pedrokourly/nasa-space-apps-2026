"""Tests for the elevation crop (issue #24)."""

import math
import sys
from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.crs import CRS
from rasterio.transform import from_origin

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import export_elevation as ex  # noqa: E402
import jezero_grid as g  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
ELEVATION = REPO / "web/public/data/elevation.bin"
CRS_DTM = CRS.from_proj4("+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396190 +units=m +no_defs")
R = g.DTM_RADIUS_M

# small synthetic bbox: 0.02 x 0.01 degrees
BBOX = (77.40, 18.40, 77.42, 18.41)
W, H = 32, 16


def make_dtm(path: Path, func, holes=()):
    """Synthetic 1 m DTM, same projection as the real one, covering the BBOX with a margin."""
    west, north = ex.lonlat_to_xy(BBOX[0] - 0.005, BBOX[3] + 0.005)
    east, south = ex.lonlat_to_xy(BBOX[2] + 0.005, BBOX[1] - 0.005)
    ncol, nrow = int(east - west), int(north - south)
    cols = west + 0.5 + np.arange(ncol)
    rows = north - 0.5 - np.arange(nrow)
    xx, yy = np.meshgrid(cols, rows)
    z = func(xx, yy).astype(np.float32)
    for r0, r1, c0, c1 in holes:
        z[r0:r1, c0:c1] = -3.4028226550889045e38
    with rasterio.open(
        path, "w", driver="GTiff", width=ncol, height=nrow, count=1, dtype="float32",
        crs=CRS_DTM, transform=from_origin(west, north, 1.0, 1.0), nodata=-3.4028226550889045e38,
    ) as dst:
        dst.write(z, 1)
    return west, north


def test_linear_ramp_is_reproduced_at_cell_centers(tmp_path):
    # z = 0.01 * x + 0.02 * y (meters): the mean of a block of a linear ramp = the value at its center.
    f = lambda x, y: 0.01 * (x - 4.6e6) + 0.02 * (y - 1.09e6)  # noqa: E731
    dtm = tmp_path / "ramp.tif"
    make_dtm(dtm, f)
    grid = ex.resample_to_grid(dtm, BBOX, W, H)
    assert grid.shape == (H, W) and grid.dtype == np.float32

    west, south = ex.lonlat_to_xy(BBOX[0], BBOX[1])
    east, north = ex.lonlat_to_xy(BBOX[2], BBOX[3])
    cx = west + (np.arange(W) + 0.5) * (east - west) / W
    cy = north - (np.arange(H) + 0.5) * (north - south) / H  # row 0 = north
    expected = f(*np.meshgrid(cx, cy))
    assert np.abs(grid - expected).max() < 0.05
    assert grid[0, 0] > grid[-1, 0]  # y grows to the north, so row 0 is the highest


def test_nodata_holes_become_nodata_never_zero(tmp_path):
    dtm = tmp_path / "holes.tif"
    make_dtm(dtm, lambda x, y: np.full_like(x, -2500.0), holes=[(300, 360, 400, 460)])
    grid = ex.resample_to_grid(dtm, BBOX, W, H)
    nd = grid == np.float32(g.NODATA)
    assert nd.any() and (~nd).any()
    assert not (grid == 0).any()
    assert np.allclose(grid[~nd], -2500.0)


def test_bbox_outside_the_dtm_is_rejected(tmp_path):
    dtm = tmp_path / "small.tif"
    make_dtm(dtm, lambda x, y: np.zeros_like(x))
    with pytest.raises(ValueError):
        ex.resample_to_grid(dtm, (77.0, 18.0, 77.1, 18.1), W, H)


def test_float32_little_endian_file_has_exact_size(tmp_path):
    dtm = tmp_path / "flat.tif"
    make_dtm(dtm, lambda x, y: np.full_like(x, -2000.0))
    grid = ex.resample_to_grid(dtm, BBOX, W, H)
    out = tmp_path / "e.bin"
    grid.astype("<f4").tofile(out)
    assert out.stat().st_size == W * H * 4
    back = np.fromfile(out, dtype="<f4").reshape(H, W)
    assert np.array_equal(back, grid)


@pytest.mark.skipif(not ELEVATION.exists(), reason="elevation.bin not generated yet")
class TestCommittedElevation:
    def test_size_and_shape_follow_meta(self):
        meta = g.build_meta()
        assert ELEVATION.stat().st_size == meta["width"] * meta["height"] * 4
        z = np.fromfile(ELEVATION, dtype="<f4").reshape(meta["height"], meta["width"])
        assert z.shape == (512, 512)

    def test_values_are_plausible_and_never_zero(self):
        z = np.fromfile(ELEVATION, dtype="<f4")
        valid = z != np.float32(g.NODATA)
        assert not (z == 0).any()
        assert np.isfinite(z).all()
        assert -2700 < z[valid].min() and z[valid].max() < -2200  # crater floor up to the rim side of the bbox

    def test_landing_site_cell_matches_the_rover_altitude(self):
        z = np.fromfile(ELEVATION, dtype="<f4").reshape(g.HEIGHT, g.WIDTH)
        min_lon, min_lat, max_lon, max_lat = g.BBOX
        lon, lat = 77.45088572, 18.44462715  # sol 13 waypoint (MMGIS), elev_geoid = -2569.91 m
        col = int((lon - min_lon) / (max_lon - min_lon) * g.WIDTH)
        row = int((max_lat - lat) / (max_lat - min_lat) * g.HEIGHT)
        assert abs(float(z[row, col]) - (-2569.91)) < 1.0
