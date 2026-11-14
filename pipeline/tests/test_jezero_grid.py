"""Testes da geometria do grid de Jezero (issue #23)."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import jezero_grid as g  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
META = REPO / "web/public/data/meta.json"
MOCK = REPO / "web/public/data/mock/meta.json"


def test_bbox_sides_between_5_and_15_km():
    for side in g.bbox_sides_m():
        assert 5000 < side < 15000


def test_bbox_inside_dtm_coverage():
    assert g.bbox_inside(g.BBOX, g.DTM_BBOX)


def test_bbox_uses_longitude_minus180_to_180():
    assert -180 <= g.BBOX[0] < g.BBOX[2] <= 180


def test_meta_fields_follow_the_contract():
    m = g.build_meta()
    assert m["crs"] == "EPSG:4326" and m["row0"] == "north" and m["dtype"] == "float32le"
    assert m["lon_convention"] == "-180..180"
    assert (m["width"], m["height"]) == (512, 512)
    assert m["nodata"] < -3.4e38


def test_m_per_cell_matches_haversine_sides():
    m = g.build_meta()
    width_m, height_m = g.bbox_sides_m()
    assert abs(m["m_per_cell_x"] * m["width"] - width_m) < 1
    assert abs(m["m_per_cell_y"] * m["height"] - height_m) < 1


def test_haversine_uses_mars_radius_not_earth():
    one_degree = g.haversine((0.0, 0.0), (1.0, 0.0))
    assert abs(one_degree - 59_158.0) < 5  # 3389,5 km * pi/180


def test_committed_meta_is_in_sync_with_the_script():
    assert json.loads(META.read_text(encoding="utf-8")) == g.build_meta()


def test_meta_has_the_same_fields_and_values_as_the_mock():
    real, mock = json.loads(META.read_text(encoding="utf-8")), json.loads(MOCK.read_text(encoding="utf-8"))
    assert set(real) == set(mock)
    for k in real:
        if k != "source":
            assert real[k] == mock[k], k
