"""Tests for the MEDA conditions file (issue #30)."""

import csv
import json
import statistics
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import export_conditions as ec  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
CONDITIONS = REPO / "web/public/data/conditions.json"
RAW = REPO / "data/raw/meda"

data = json.loads(CONDITIONS.read_text(encoding="utf-8"))
raw_available = all(
    (RAW / f"WE__{s:04d}___________{k}P01.CSV").exists() for s in ec.SOLS for k in (ec.PS, ec.RHS, ec.ATS)
)


def test_has_at_least_3_sols_with_sol_utc_and_variables():
    assert len(data["sols"]) >= 3
    for s in data["sols"]:
        assert isinstance(s["sol"], int)
        assert s["utc_start"].endswith("Z") and s["utc_end"].endswith("Z") and s["utc_start"] < s["utc_end"]
        assert set(s["variables"]) == {"pressure", "air_temperature", "relative_humidity", "wind", "dust"}


def test_source_names_mission_instrument_release_and_doi_and_latest_sol():
    src = data["source"]
    assert src["mission_id"] == "mars2020-meda" and "MEDA" in src["instrument"]
    assert src["release"] == "mars2020_meda-20260811" and src["doi"] == "10.17189/1522849"
    assert data["latest_sol"] == max(s["sol"] for s in data["sols"])


def test_nothing_says_live_or_real_time():
    source_without_note = {k: v for k, v in data["source"].items() if k != "note"}
    text = json.dumps({**data, "source": source_without_note}).lower()
    for word in ("live", "real-time", "real time", "ao vivo"):
        assert word not in text
    assert "not a live feed" in data["source"]["note"].lower()


def test_available_variables_have_unit_stats_and_consistent_order():
    for s in data["sols"]:
        for name, v in s["variables"].items():
            if v["status"] == "ok":
                assert v["unit"] and v["n"] > 0 and v["product"] and v["level"] in ("derived", "calibrated")
                assert v["min"] <= v["mean"] <= v["max"], (s["sol"], name)


def test_unavailable_variables_carry_a_reason_and_no_numbers():
    unavailable = [(s["sol"], n, v) for s in data["sols"] for n, v in s["variables"].items() if v["status"] != "ok"]
    assert {n for _, n, _ in unavailable} == {"wind", "dust"}
    for _, _, v in unavailable:
        assert v["status"] == "unavailable" and v["reason"]
        assert not ({"min", "mean", "max", "n", "unit"} & set(v))


def test_values_are_physically_plausible_for_jezero():
    for s in data["sols"]:
        v = s["variables"]
        assert 500 < v["pressure"]["min"] and v["pressure"]["max"] < 1000  # Pa
        assert 150 < v["air_temperature"]["min"] and v["air_temperature"]["max"] < 320  # K
        assert 0 <= v["relative_humidity"]["min"] and v["relative_humidity"]["max"] <= 100  # %


@pytest.mark.skipif(not raw_available, reason="raw MEDA files not in data/raw/meda")
class TestAgainstTheSourceCsv:
    def column(self, sol, kind, name):
        with (RAW / f"WE__{sol:04d}___________{kind}P01.CSV").open(newline="", encoding="utf-8") as f:
            return [float(r[name]) for r in csv.DictReader(f) if r[name].strip()]

    def test_pressure_and_humidity_match_the_csv(self):
        for s in data["sols"]:
            for var, kind, col in (("pressure", ec.PS, "PRESSURE"), ("relative_humidity", ec.RHS, "LOCAL_RELATIVE_HUMIDITY")):
                vals = self.column(s["sol"], kind, col)
                got = s["variables"][var]
                assert got["n"] == len(vals)
                assert got["min"] == round(min(vals), 2) and got["max"] == round(max(vals), 2)
                assert got["mean"] == round(statistics.fmean(vals), 2)

    def test_air_temperature_matches_the_csv(self):
        for s in data["sols"]:
            with (RAW / f"WE__{s['sol']:04d}___________{ec.ATS}P01.CSV").open(newline="", encoding="utf-8") as f:
                rows = [[float(r[c]) for c in ec.ATS_SENSORS if r[c].strip()] for r in csv.DictReader(f)]
            means = [statistics.fmean(v) for v in rows if v]
            got = s["variables"]["air_temperature"]
            assert got["n"] == len(means)
            assert got["min"] == round(min(means), 2) and got["max"] == round(max(means), 2)
            assert got["mean"] == round(statistics.fmean(means), 2)

    def test_committed_file_matches_the_script(self):
        assert data == ec.build()
