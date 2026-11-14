"""Build web/public/data/conditions.json from MEDA data (issue #30).

Reads the Mars 2020 MEDA CSV products of the three most recent sols of the release,
computes min, mean and max per sol for each variable and writes the conditions file
used by the conditions panel.

Raw files (not versioned) go in data/raw/meda/, copied from the PDS Atmospheres node:
    https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/
    data_derived_env/sol_1740_1859/sol_NNNN/WE__NNNN___________DER_PS__________________P01.CSV (+ .xml)
    data_derived_env/sol_1740_1859/sol_NNNN/WE__NNNN___________DER_RHS_________________P01.CSV (+ .xml)
    data_calibrated_env/sol_1740_1859/sol_NNNN/WE__NNNN___________CAL_ATS_________________P01.CSV (+ .xml)

Usage (from the repository root):
    pipeline/.venv/Scripts/python pipeline/export_conditions.py

Choices (see docs/conditions.md):
- Derived level for pressure and humidity, calibrated level for air temperature: the MEDA
  readme recommends the derived level when it exists for a sensor, otherwise the calibrated one.
- Empty cells are missing data and are skipped, never replaced by a value.
- Wind and dust have no usable product for these sols, so they are written as "unavailable".
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path

RAW_DIR = Path("data/raw/meda")
OUT_PATH = Path("web/public/data/conditions.json")

SOLS = (1857, 1858, 1859)
RELEASE = "mars2020_meda-20260811"
DOI = "10.17189/1522849"
ATS_SENSORS = ("ATS_LOCAL_TEMP1", "ATS_LOCAL_TEMP2", "ATS_LOCAL_TEMP3", "ATS_LOCAL_TEMP4", "ATS_LOCAL_TEMP5")


def product(sol: int, kind: str, ext: str = "CSV") -> Path:
    """Path of a MEDA product, e.g. kind = 'DER_PS__________________'."""
    return RAW_DIR / f"WE__{sol:04d}___________{kind}P01.{ext}"


PS, RHS, ATS = "DER_PS__________________", "DER_RHS_________________", "CAL_ATS_________________"


def read_column(path: Path, column: str) -> list[float]:
    """Numeric values of a CSV column, skipping empty cells."""
    values = []
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            cell = (row.get(column) or "").strip()
            if cell:
                values.append(float(cell))
    return values


def read_row_means(path: Path, columns: tuple[str, ...]) -> list[float]:
    """Per-row mean of the columns that have a value, skipping rows with none."""
    means = []
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            vals = [float(row[c]) for c in columns if (row.get(c) or "").strip()]
            if vals:
                means.append(sum(vals) / len(vals))
    return means


def stats(values: list[float]) -> dict:
    if not values:
        raise ValueError("no valid values")
    return {
        "min": round(min(values), 2),
        "mean": round(sum(values) / len(values), 2),
        "max": round(max(values), 2),
        "n": len(values),
    }


def label_times(path: Path) -> tuple[str, str]:
    text = path.read_text(encoding="utf-8")
    start = re.search(r"<start_date_time>([^<]+)<", text)
    stop = re.search(r"<stop_date_time>([^<]+)<", text)
    if not (start and stop):
        raise ValueError(f"{path.name}: no time coordinates")
    return start.group(1), stop.group(1)


def build_sol(sol: int) -> dict:
    starts, stops = zip(*(label_times(product(sol, k, "xml")) for k in (PS, RHS, ATS)))
    return {
        "sol": sol,
        "utc_start": min(starts),
        "utc_end": max(stops),
        "variables": {
            "pressure": {
                "status": "ok", "unit": "Pa", "level": "derived", "product": "DER_PS", "column": "PRESSURE",
                **stats(read_column(product(sol, PS), "PRESSURE")),
            },
            "air_temperature": {
                "status": "ok", "unit": "K", "level": "calibrated", "product": "CAL_ATS",
                "column": "mean of ATS_LOCAL_TEMP1..5 per record",
                **stats(read_row_means(product(sol, ATS), ATS_SENSORS)),
            },
            "relative_humidity": {
                "status": "ok", "unit": "%", "level": "derived", "product": "DER_RHS",
                "column": "LOCAL_RELATIVE_HUMIDITY",
                **stats(read_column(product(sol, RHS), "LOCAL_RELATIVE_HUMIDITY")),
            },
            "wind": {
                "status": "unavailable",
                "reason": "No wind sensor (WS) product is listed for this sol in the derived or calibrated collections.",
            },
            "dust": {
                "status": "unavailable",
                "reason": "No dust variable in the products used (DER_PS, DER_RHS, CAL_ATS); the dust sensor (RDS) product was not used.",
            },
        },
    }


def build() -> dict:
    sols = sorted((build_sol(s) for s in SOLS), key=lambda s: s["sol"], reverse=True)
    return {
        "source": {
            "mission": "Mars 2020 (Perseverance)",
            "mission_id": "mars2020-meda",
            "instrument": "MEDA (Mars Environmental Dynamics Analyzer)",
            "bundle": "mars2020_meda",
            "release": RELEASE,
            "doi": DOI,
            "url": "https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/",
            "note": "Last data available in the release, not a live feed.",
        },
        "latest_sol": sols[0]["sol"],
        "sols": sols,
    }


def main() -> None:
    missing = [p for s in SOLS for k in (PS, RHS, ATS) for p in (product(s, k), product(s, k, "xml")) if not p.exists()]
    if missing:
        raise SystemExit("Missing raw files in data/raw/meda/:\n  " + "\n  ".join(p.name for p in missing))
    out = build()
    OUT_PATH.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH}: latest sol {out['latest_sol']}, {len(out['sols'])} sols, release {RELEASE}")
    for s in out["sols"]:
        v = s["variables"]
        print(f"  sol {s['sol']}  {s['utc_start'][:16]} .. {s['utc_end'][:16]} UTC  "
              f"P {v['pressure']['min']:.0f}-{v['pressure']['max']:.0f} Pa  "
              f"T {v['air_temperature']['min']:.1f}-{v['air_temperature']['max']:.1f} K  "
              f"RH {v['relative_humidity']['min']:.1f}-{v['relative_humidity']['max']:.1f} %")


if __name__ == "__main__":
    main()
