"""Build web/public/data/targets.geojson from curated Jezero targets (issue #28).

The coordinates are pinned below so the build is offline and reproducible. Each one is
the position of the Perseverance rover on the sol the NASA "Mars Rock Samples" table
gives for the sample (taken from the official MMGIS waypoints, see docs/targets.md).
`python pipeline/export_targets.py --verify` re-downloads the waypoints and checks them.

The script fails if a target is outside the grid bbox, falls on a nodata cell, has an
invalid longitude, or points to a mission missing from missions.json.

Usage (from the repository root):
    pipeline/.venv/Scripts/python pipeline/export_targets.py [--verify]
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

import numpy as np

from jezero_grid import BBOX, ELEVATION_PATH, HEIGHT, NODATA, WIDTH

TARGETS_PATH = Path("web/public/data/targets.geojson")
MISSIONS_PATHS = (Path("web/public/data/missions.json"), Path("web/public/data/mock/missions.json"))
WAYPOINTS_URL = "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json"

# Waypoint = the last rover waypoint at or before the sample sol. `lon`, `lat`: MMGIS waypoint,
# rounded to 5 decimals (~1 m). Every claim in `why` is tied to a source in docs/targets.md
# ("Sources of the `why` texts"); Product may still polish the wording but not the facts.
TARGETS = [
    {
        "id": "habitat",
        "name": "Habitat (landing site)",
        "why": (
            "Start and finish of every walk: the Octavia E. Butler landing site, where Perseverance "
            "touched down on the floor of Jezero. Routes here must return to this point, and the 1 m "
            "terrain behind them comes from MRO's HiRISE camera."
        ),
        "mission": "mro-hirise",
        "lon": 77.45089, "lat": 18.44463, "waypoint_sol": 13,
    },
    {
        "id": "artuby-ridge",
        "name": "Artuby Ridge (Rochette)",
        "why": (
            "A 2 to 3 m cliff of Máaz formation rock on the crater floor, less than 1 km from the "
            "habitat. These igneous rocks were likely lava flows, and Perseverance cored two samples "
            "here, Montdenier and Montagnac."
        ),
        "mission": "mro-hirise",
        "lon": 77.44437, "lat": 18.43074, "waypoint_sol": 180,
    },
    {
        "id": "seitah",
        "name": "Séítah olivine cumulate (Brac)",
        "why": (
            "Séítah, possibly the oldest rock on the crater floor: coarse, layered, olivine-rich rock "
            "that likely cooled from a thick lava flow, laccolith or lava lake. MRO's CRISM had mapped "
            "olivine in this region from orbit; here Perseverance sampled it up close (Salette and "
            "Coulettes)."
        ),
        "mission": "mro-crism",
        "lon": 77.44302, "lat": 18.43396, "waypoint_sol": 248,
    },
    {
        "id": "delta-front",
        "name": "Delta front (Skinner Ridge)",
        "why": (
            "Where an ancient river met a lake. Jezero held a delta-lake system with high potential "
            "to preserve signs of past life, and here the rover cored layered sedimentary rock at "
            "Skinner Ridge and Wildcat Ridge (Swift Run, Skyland, Hazeltop and Bearwallow)."
        ),
        "mission": "mro-hirise",
        "lon": 77.40617, "lat": 18.45890, "waypoint_sol": 477,
    },
    {
        "id": "upper-fan",
        "name": "Upper delta fan (Berea)",
        "why": (
            "The top of the delta holds the last chapter of water in Jezero and some of the coarsest "
            "sediments seen so far. Reaching it means climbing about 120 m above the habitat. At "
            "Berea the rover cored Melyn, from alternating layers of sandstone and coarser rock."
        ),
        "mission": "mro-hirise",
        "lon": 77.38407, "lat": 18.47020, "waypoint_sol": 736,
    },
    {
        "id": "margin-carbonates",
        "name": "Margin unit carbonates (Comet Geyser)",
        "why": (
            "The margin unit, beside the western crater rim, is where orbital spectrometers saw the "
            "strongest carbonate signal in Jezero, and it has been proposed as an ancient lake "
            "shoreline. Here the rover cored Comet Geyser, a silica-cemented carbonate."
        ),
        "mission": "mro-crism",
        "lon": 77.32720, "lat": 18.49183, "waypoint_sol": 1088,
    },
]


def load_mission_ids() -> set[str]:
    for p in MISSIONS_PATHS:
        if p.exists():
            return {m["id"] for m in json.loads(p.read_text(encoding="utf-8"))}
    raise SystemExit("missions.json not found")


def cell_of(lon: float, lat: float) -> tuple[int, int]:
    min_lon, min_lat, max_lon, max_lat = BBOX
    return (
        int((max_lat - lat) / (max_lat - min_lat) * HEIGHT),
        int((lon - min_lon) / (max_lon - min_lon) * WIDTH),
    )


def validate(targets: list[dict], mission_ids: set[str], elevation: np.ndarray) -> None:
    min_lon, min_lat, max_lon, max_lat = BBOX
    ids = [t["id"] for t in targets]
    assert len(ids) == len(set(ids)), "duplicate target ids"
    assert 3 <= len(targets) <= 6, "expected 3 to 6 targets"
    for t in targets:
        assert all(t.get(k) for k in ("id", "name", "why", "mission")), f"{t['id']}: empty field"
        assert -180 <= t["lon"] <= 180, f"{t['id']}: longitude outside -180..180"
        assert min_lon <= t["lon"] < max_lon and min_lat <= t["lat"] < max_lat, f"{t['id']}: outside the bbox"
        assert t["mission"] in mission_ids, f"{t['id']}: mission {t['mission']} not in missions.json"
        row, col = cell_of(t["lon"], t["lat"])
        assert elevation[row, col] != np.float32(NODATA), f"{t['id']}: nodata cell"


def build(targets: list[dict]) -> dict:
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [t["lon"], t["lat"]]},
                "properties": {k: t[k] for k in ("id", "name", "why", "mission")},
            }
            for t in targets
        ],
    }


def verify_against_mmgis(targets: list[dict]) -> None:
    with urllib.request.urlopen(WAYPOINTS_URL, timeout=60) as r:
        feats = json.load(r)["features"]
    wps = sorted((f["properties"]["sol"], *f["geometry"]["coordinates"][:2]) for f in feats)
    for t in targets:
        sol, lon, lat = [w for w in wps if w[0] <= t["waypoint_sol"]][-1]
        ok = abs(lon - t["lon"]) < 1e-5 and abs(lat - t["lat"]) < 1e-5
        print(f"{'OK ' if ok else 'DIFF'} {t['id']:14s} waypoint sol {sol}: {lon:.5f} {lat:.5f}")
        assert ok, f"{t['id']}: pinned coordinates differ from the MMGIS waypoint"


def main() -> None:
    elevation = np.fromfile(ELEVATION_PATH, dtype="<f4").reshape(HEIGHT, WIDTH)
    validate(TARGETS, load_mission_ids(), elevation)
    if "--verify" in sys.argv:
        verify_against_mmgis(TARGETS)
    TARGETS_PATH.write_text(json.dumps(build(TARGETS), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {TARGETS_PATH} with {len(TARGETS)} targets")


if __name__ == "__main__":
    main()
