"""Tests that docs/data-sources.md covers every data file (issue #33)."""

import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DATA = REPO / "web/public/data"
DOC = (REPO / "docs/data-sources.md").read_text(encoding="utf-8")

# Entries documented but not in missions.json yet (none: mars2020-rover was added on 2026-11-15).
PROPOSED_MISSION_IDS: set[str] = set()


def test_every_file_in_public_data_has_a_row():
    files = [p.name for p in DATA.iterdir() if p.is_file() and not p.name.startswith(".")]
    assert files, "no data files found"
    missing = [name for name in files if f"`{name}`" not in DOC]
    assert not missing, f"add a row to docs/data-sources.md for: {missing}"


def test_every_generated_file_row_names_a_doi_and_a_data_date():
    for name in ("elevation.bin", "slope.bin", "meta.json", "targets.geojson", "conditions.json"):
        row = next(line for line in DOC.splitlines() if line.startswith(f"| `{name}`"))
        assert "doi.org" in row or "10." in row, name
        assert re.search(r"20\d\d", row), name


def test_required_dois_are_listed():
    assert "10.5066/P9REJ9JN" in DOC  # HiRISE DTM
    assert "10.17189/1522849" in DOC  # MEDA bundle


def test_every_mission_id_in_the_doc_exists_in_missions_json_or_is_proposed():
    known = {m["id"] for m in json.loads((DATA / "missions.json").read_text(encoding="utf-8"))}
    used = set(re.findall(r"`((?:mro|mgs|odyssey|mars2020)-[a-z0-9-]+)`", DOC))
    assert used, "no mission ids found in the doc"
    assert used <= known | PROPOSED_MISSION_IDS, used - known - PROPOSED_MISSION_IDS


def test_assumptions_are_listed_and_marked_in_the_files_table():
    ids = re.findall(r"^\| (A\d+) \|", DOC, flags=re.M)
    assert len(ids) >= 9
    table = DOC.split("## 2.")[0]
    for a in ids[:9]:
        assert a in table, f"{a} is not marked in any row of section 1"
