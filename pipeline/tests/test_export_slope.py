"""Tests for the slope (issue #25)."""

import json
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import export_slope as es  # noqa: E402
import jezero_grid as g  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
SLOPE = REPO / "web/public/data/slope.bin"
ELEVATION = REPO / "web/public/data/elevation.bin"
ND = g.NODATA
DX, DY = 15.345, 11.554  # different meters per cell in x and y (as in the real meta.json)
N = 40


def plane(angle_deg: float, direction_deg: float, dx: float = DX, dy: float = DY, n: int = N) -> np.ndarray:
    """Plane tilted `angle_deg`, rising toward `direction_deg` (0 = east, 90 = north)."""
    rows, cols = np.mgrid[0:n, 0:n]
    x = cols * dx
    y = -rows * dy  # row 0 = north, y grows to the north
    t = math.radians(direction_deg)
    return (math.tan(math.radians(angle_deg)) * (x * math.cos(t) + y * math.sin(t))).astype(np.float32)


def interior(a: np.ndarray) -> np.ndarray:
    return a[1:-1, 1:-1]


def test_10_degree_ramp_in_x_returns_10_degrees():
    s = es.horn_slope(plane(10, 0), DX, DY, ND)
    assert np.allclose(interior(s), 10.0, atol=0.1)


def test_10_degree_ramp_in_y_with_different_cell_sizes_returns_10_degrees():
    s = es.horn_slope(plane(10, 90), DX, DY, ND)
    assert np.allclose(interior(s), 10.0, atol=0.1)
    # If the code used the same cell size on both axes, the result would be different.
    wrong = es.horn_slope(plane(10, 90), DX, DX, ND)
    assert not np.allclose(interior(wrong), 10.0, atol=0.1)


@pytest.mark.parametrize("direction", [30, 135, 225, 300])
def test_oblique_ramp_returns_the_plane_angle(direction):
    s = es.horn_slope(plane(15, direction), DX, DY, ND)
    assert np.allclose(interior(s), 15.0, atol=0.1)


def test_flat_terrain_is_zero_on_valid_cells():
    s = es.horn_slope(np.full((N, N), -2500.0, dtype=np.float32), DX, DY, ND)
    assert np.allclose(interior(s), 0.0)


def test_border_cells_are_nodata():
    s = es.horn_slope(plane(10, 0), DX, DY, ND)
    for edge in (s[0, :], s[-1, :], s[:, 0], s[:, -1]):
        assert (edge == np.float32(ND)).all()


def test_nodata_cell_contaminates_itself_and_its_8_neighbours_only():
    z = plane(10, 0)
    z[20, 20] = np.float32(ND)
    s = es.horn_slope(z, DX, DY, ND)
    bad = s[1:-1, 1:-1] == np.float32(ND)
    expected = np.zeros_like(bad)
    expected[19 - 1 : 22 - 1, 19 - 1 : 22 - 1] = True  # 3x3 around (20, 20) in the interior
    assert np.array_equal(bad, expected)


def test_nodata_is_never_turned_into_zero_or_valid_value():
    z = plane(10, 0)
    z[10:13, 10:13] = np.float32(ND)
    s = es.horn_slope(z, DX, DY, ND)
    is_nd = s == np.float32(ND)
    assert is_nd.any()
    assert not (s[is_nd] == 0).any()
    assert (s[~is_nd] >= 0).all() and (s[~is_nd] <= 90).all()


def test_rejects_grids_smaller_than_3x3():
    with pytest.raises(ValueError):
        es.horn_slope(np.zeros((2, 5), dtype=np.float32), DX, DY, ND)


def test_export_writes_exact_size_and_same_grid(tmp_path):
    meta = {"width": N, "height": N, "m_per_cell_x": DX, "m_per_cell_y": DY, "nodata": ND}
    (tmp_path / "meta.json").write_text(json.dumps(meta))
    plane(10, 0).astype("<f4").tofile(tmp_path / "elevation.bin")
    s = es.export(tmp_path / "elevation.bin", tmp_path / "meta.json", tmp_path / "slope.bin")
    assert (tmp_path / "slope.bin").stat().st_size == N * N * 4
    back = np.fromfile(tmp_path / "slope.bin", dtype="<f4").reshape(N, N)
    assert np.array_equal(back, s)


@pytest.mark.skipif(not (SLOPE.exists() and ELEVATION.exists()), reason="slope.bin not generated yet")
class TestCommittedSlope:
    meta = g.build_meta()

    def test_same_size_and_grid_as_elevation(self):
        assert SLOPE.stat().st_size == ELEVATION.stat().st_size == self.meta["width"] * self.meta["height"] * 4

    def test_valid_values_between_0_and_90_and_nodata_stays_nodata(self):
        shape = (self.meta["height"], self.meta["width"])
        slope = np.fromfile(SLOPE, dtype="<f4").reshape(shape)
        elev = np.fromfile(ELEVATION, dtype="<f4").reshape(shape)
        nd = np.float32(self.meta["nodata"])
        valid = slope != nd
        assert (slope[valid] >= 0).all() and (slope[valid] <= 90).all()
        assert np.isfinite(slope).all()
        assert not (slope == 0).all()
        # Where the elevation is nodata, the slope is nodata too.
        assert (slope[elev == nd] == nd).all()

    def test_only_the_border_is_nodata_when_elevation_has_no_holes(self):
        shape = (self.meta["height"], self.meta["width"])
        slope = np.fromfile(SLOPE, dtype="<f4").reshape(shape)
        nd = np.float32(self.meta["nodata"])
        inner = slope[1:-1, 1:-1]
        assert (inner != nd).all()
