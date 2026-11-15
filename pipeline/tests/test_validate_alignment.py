"""Tests for the alignment measurement (issue #32). No network: tiles are faked."""

import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import validate_alignment as va  # noqa: E402

N = va.N


def blobs(seed=1):
    """A smooth random field with plenty of edges."""
    rng = np.random.default_rng(seed)
    a = rng.normal(size=(N, N))
    return va.gaussian(a, 6.0)


def shifted(a, d_col, d_row):
    """b with b(x) = a(x - d), done with integer rolls."""
    return np.roll(np.roll(a, d_row, axis=0), d_col, axis=1)


def test_shift_between_recovers_a_known_integer_shift():
    a = blobs()
    b = shifted(a, 7, -4)
    d_col, d_row, peak = va.shift_between(b, a)
    assert abs(d_col - 7) < 0.3 and abs(d_row + 4) < 0.3
    assert peak > 0.5


def test_shift_between_of_identical_fields_is_zero_with_peak_one():
    a = blobs(2)
    d_col, d_row, peak = va.shift_between(a, a)
    assert abs(d_col) < 1e-6 and abs(d_row) < 1e-6
    assert peak > 0.99


def test_to_meters_signs_east_positive_north_positive():
    east, north = va.to_meters(10, 0, 18.45)
    assert east > 0 and abs(north) < 1e-9
    east, north = va.to_meters(0, 10, 18.45)  # rows grow to the south
    assert abs(east) < 1e-9 and north < 0
    dx, dy = va.meters_per_px(18.45)
    assert abs(dx / dy - math.cos(math.radians(18.45))) < 1e-9


def test_hillshade_is_brighter_on_slopes_facing_the_sun():
    # Terrain rising to the east: the west-facing... a slope that faces west is lit by a western sun.
    cols = np.tile(np.arange(N, dtype=float), (N, 1))
    rising_east = 0.5 * cols  # the surface faces west
    lit_from_west = va.hillshade(rising_east, 1.0, 1.0, azimuth=270, elevation=30).mean()
    lit_from_east = va.hillshade(rising_east, 1.0, 1.0, azimuth=90, elevation=30).mean()
    assert lit_from_west > lit_from_east


def test_hillshade_of_flat_terrain_is_the_sine_of_the_sun_elevation():
    h = va.hillshade(np.zeros((N, N)), 1.0, 1.0, azimuth=135, elevation=40)
    assert np.allclose(h, math.sin(math.radians(40)))


def test_hirise_patch_georeferences_with_the_tile_grid(monkeypatch):
    # Fake tiles whose gray value is the tile column: the crop center must carry the center tile.
    calls = []

    def fake_tile(x, y):
        calls.append((x, y))
        return np.full((256, 256), float(x % 250), dtype=np.float32)

    monkeypatch.setattr(va, "fetch_tile", fake_tile)
    lon, lat = 77.40, 18.46
    img, lon_left, lat_top = va.hirise_patch(lon, lat)
    assert img.shape == (N, N)
    # The patch corner, plus half the patch, must come back to the requested center.
    lon_c = lon_left + N / 2 * va.PX_DEG
    lat_c = lat_top - N / 2 * va.PX_DEG
    assert abs(lon_c - lon) < va.PX_DEG and abs(lat_c - lat) < va.PX_DEG
    # Tile index formulas of the EPSG:4326 pyramid used by Mars Trek.
    n = 2**va.ZOOM
    assert (int(n * (lon / 180 + 1)), int(n * (0.5 - lat / 180))) in calls


def test_the_pixel_grid_has_the_same_size_in_lon_and_lat_degrees():
    assert abs(va.PX_DEG - 180 / 2**va.ZOOM / 256) < 1e-15
