"""Tests for the Jezero targets (issue #28)."""

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import export_targets as et  # noqa: E402
import jezero_grid as g  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
TARGETS = REPO / "web/public/data/targets.geojson"
MISSIONS = REPO / "web/public/data/mock/missions.json"
ELEVATION = REPO / "web/public/data/elevation.bin"
SLOPE = REPO / "web/public/data/slope.bin"

collection = json.loads(TARGETS.read_text(encoding="utf-8"))
features = collection["features"]
mission_ids = {m["id"] for m in json.loads(MISSIONS.read_text(encoding="utf-8"))}
grid_shape = (g.HEIGHT, g.WIDTH)


def test_is_a_feature_collection_of_3_to_5_points():
    assert collection["type"] == "FeatureCollection"
    assert 3 <= len(features) <= 5
    assert all(f["geometry"]["type"] == "Point" for f in features)


def test_every_target_has_id_name_why_and_mission():
    for f in features:
        for key in ("id", "name", "why", "mission"):
            assert isinstance(f["properties"].get(key), str) and f["properties"][key].strip(), (f, key)
    ids = [f["properties"]["id"] for f in features]
    assert len(ids) == len(set(ids)) and "habitat" in ids


def test_every_mission_exists_in_missions_json():
    for f in features:
        assert f["properties"]["mission"] in mission_ids


def test_coordinates_are_inside_the_bbox_with_longitude_minus180_to_180():
    min_lon, min_lat, max_lon, max_lat = g.BBOX
    for f in features:
        lon, lat = f["geometry"]["coordinates"]
        assert -180 <= lon <= 180
        assert min_lon <= lon < max_lon and min_lat <= lat < max_lat


def test_every_target_sits_on_a_valid_elevation_and_slope_cell():
    elevation = np.fromfile(ELEVATION, dtype="<f4").reshape(grid_shape)
    slope = np.fromfile(SLOPE, dtype="<f4").reshape(grid_shape)
    nodata = np.float32(g.NODATA)
    for f in features:
        row, col = et.cell_of(*f["geometry"]["coordinates"])
        assert elevation[row, col] != nodata
        assert slope[row, col] != nodata
        assert slope[row, col] < 25  # reachable on foot (routing owns the final threshold)


def test_committed_file_matches_the_script():
    assert collection == et.build(et.TARGETS)


def test_mock_free_flag_is_not_set():
    assert all("mock" not in f["properties"] for f in features)
