# Mars conditions (MEDA)

Source of `web/public/data/conditions.json` (issue #30), built by `pipeline/export_conditions.py`.

The panel shows **the last data available**, with its sol and UTC dates. It is not a live feed.

## Provenance

| Field | Value |
|---|---|
| Mission | Mars 2020 (Perseverance), NASA |
| Instrument | MEDA (Mars Environmental Dynamics Analyzer) |
| PDS bundle | `mars2020_meda`, release `mars2020_meda-20260811` (the most recent in the PDS Atmospheres releases list) |
| DOI | [10.17189/1522849](https://doi.org/10.17189/1522849) |
| Data location | https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/ (PDS Atmospheres node) |
| Sols | 1857, 1858 and 1859 (the last sol in the release), UTC 2026-05-11 to 2026-05-14 |
| Timestamps | `utc_start` and `utc_end` come from the `start_date_time` and `stop_date_time` of the PDS label of each product |

The release root `https://pds.nasa.gov/data/pds4/releases/atmos/mars2020_meda-20260811/` holds the bundle labels and the readme, but the CSV files are served by the Atmospheres node. Its last sol (1859) is the same as the release inventory, so the data matches the release. The files were read on 2026-11-14.

## Which product gives which variable

The MEDA readme recommends the **derived** level when a sensor has one, and the **calibrated** level otherwise.

| Variable | Product (level) | Column | Unit | Notes |
|---|---|---|---|---|
| `pressure` | `DER_PS` (derived) | `PRESSURE` | Pa | Derived from barocap 3 |
| `air_temperature` | `CAL_ATS` (calibrated) | `ATS_LOCAL_TEMP1` to `5` | K | No derived product exists for the air sensors |
| `relative_humidity` | `DER_RHS` (derived) | `LOCAL_RELATIVE_HUMIDITY` | % | Local to the sensor, see below |
| `wind` | none | none | none | **Unavailable** |
| `dust` | none | none | none | **Unavailable** |

Each value is the minimum, mean and maximum over all valid records of the sol, with `n` the number of records. Empty cells are missing data and are skipped; no value is ever invented.

## Gaps (shown as unavailable)

- **Wind:** the listing of `data_derived_env` and `data_calibrated_env` for sols 1857 to 1859 has no wind sensor (WS) product. We did not check why, nor other sols.
- **Dust:** none of the three products used has a dust variable. The dust sensor (RDS, `CAL_RDS`, about 11 MB per sol) was not downloaded or analyzed.
- **Ground temperature:** not provided. The derived `DER_TIRS` product has long-wave **irradiance** (W/m²), not temperature, and turning it into a temperature needs an emissivity assumption we did not make.

## Assumptions

- **Air temperature is the mean of the five air sensors** (`ATS_LOCAL_TEMP1` to `5`) in each record, using the sensors that have a value. According to the labels the sensors sit at different places on the rover (three near the unit on the remote sensing mast, two near the RFB unit) and read up to about 5 K apart (194.8 K against 200.1 K in the first record of sol 1859), so the number is a representative value, not a measurement at a specific height.
- **Humidity unit is assumed to be percent.** The PDS label gives no unit for `LOCAL_RELATIVE_HUMIDITY`; the values are between 0.18 and 81, consistent with a percentage. It is the relative humidity **at the sensor's own temperature**, not of the ambient air.
- **Sol dates are the label coverage of the products**, not a conversion from the sol number.
- **The PDS label of `DER_PS` gives the unit of `PRESSURE_UNCERTAINTY` as kelvin**, which looks like a label error. We do not use that column.
- The readme says humidity data before sol 63 and wind data before sol 36 are unreliable; the sols used are far later.

## Checks

`pipeline/tests/test_export_conditions.py` recomputes min, mean, max and the record count of every variable and sol straight from the raw CSV files and compares them with `conditions.json` (skipped when `data/raw/meda/` is absent). It also checks that there are at least 3 sols, that the DOI and release are present, that unavailable variables carry no numbers and that no text says "live". `web/src/lib/realConditions.test.ts` checks the same file with the types of `web/src/types/contract.ts`.

## Reproduce

Download these 18 files (about 37 MB) into `data/raw/meda/`, which is ignored by git, for each sol in 1857, 1858 and 1859:

- `data_derived_env/sol_1740_1859/sol_NNNN/WE__NNNN___________DER_PS__________________P01.CSV` and `.xml`
- `data_derived_env/sol_1740_1859/sol_NNNN/WE__NNNN___________DER_RHS_________________P01.CSV` and `.xml`
- `data_calibrated_env/sol_1740_1859/sol_NNNN/WE__NNNN___________CAL_ATS_________________P01.CSV` and `.xml`

```bash
pipeline/.venv/Scripts/python pipeline/export_conditions.py
pipeline/.venv/Scripts/python -m pytest pipeline/tests/test_export_conditions.py
```
