# Science targets of Jezero

Source of `web/public/data/targets.geojson` (issue #28), built by `pipeline/export_targets.py`.

## How the targets were chosen

- The EVA story needs a start point (the habitat) and 3 to 4 places worth visiting, all **inside the grid bbox** `[77.36, 18.40, 77.50, 18.50]` and on a valid elevation and slope cell.
- Every science target is a place where Perseverance cored a rock sample, so each one has an official name, a sol and a rock type.
- The set mixes igneous crater-floor rock, olivine-rich Séítah rock, the delta front and the top of the delta, which also gives the route a flat leg, a steep edge and a long climb.

## Where each coordinate comes from

1. **Sample names, sols, features and sampling locations:** the official NASA table [Mars Rock Samples](https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/) (read on 2026-11-14).
2. **Position:** the Perseverance waypoints published by NASA on MMGIS, `https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json` (fields `sol`, `lon`, `lat`, `elev_geoid`, read on 2026-11-14). A target uses the last waypoint at or before the sample sol, rounded to 5 decimals (about 1 m).
3. **Landing site:** the first waypoint (sol 13) agrees with [Wikidata Q105824100](https://www.wikidata.org/wiki/Q105824100) and with NASA GISS [Mars24](https://www.giss.nasa.gov/tools/mars24/help/landers.html) (77.45°E, 18.44°N).

`python pipeline/export_targets.py --verify` downloads the waypoints again and checks that the pinned coordinates still match.

| id | lon, lat | Waypoint sol | Samples (official table) | Cell (row, col) | Elevation | Slope | Straight line from habitat |
|---|---|---|---|---|---|---|---|
| `habitat` | 77.45089, 18.44463 | 13 | Landing site | 283, 332 | −2569.9 m | 0.6° | 0 km |
| `artuby-ridge` | 77.44437, 18.43074 | 180 | Montdenier (sol 194), Montagnac (sol 196), feature Rochette | 354, 308 | −2574.5 m | 1.0° | 0.90 km |
| `seitah` | 77.44302, 18.43396 | 248 | Salette (sol 262), Coulettes (sol 271), feature Brac, South Séítah | 338, 303 | −2569.0 m | 2.5° | 0.77 km |
| `delta-front` | 77.40617, 18.45890 | 477 | Swift Run (490), Skyland (495) at Skinner Ridge; Hazeltop (509), Bearwallow (516) at Wildcat Ridge | 210, 168 | −2520.6 m | 17.0° | 2.65 km |
| `upper-fan` | 77.38407, 18.47020 | 736 | Melyn (sol 749), feature Berea, Upper Fan | 152, 88 | −2449.2 m | 3.1° | 4.04 km |

Elevation and slope are read from `elevation.bin` and `slope.bin`.

## Missions

`mission` points to an entry of `missions.json`. Here it means the MRO instrument whose data shows or revealed the feature:

- `mro-hirise` for the habitat, Artuby Ridge, the delta front and the upper fan: all are visible on the HiRISE basemap, which is also the source of the terrain model (`docs/dados-relevo.md`).
- `mro-crism` for Séítah: the olivine and carbonate terrain of Jezero comes from orbital near-infrared spectroscopy. Beyssac et al. (2023, JGR Planets) suggest Séítah belongs to the regional olivine-carbonate unit seen from orbit.

## Checks

- Each target falls on the feature it describes when drawn over the Mars Trek HiRISE 25 cm tiles: the delta front sits at the foot of the delta scarp, the upper fan on top of the delta, and Séítah and Artuby Ridge on the contact between the smooth Máaz plains and the rippled Séítah terrain. This was an inspection by eye on a test page, not an automated test.
- `pipeline/tests/test_export_targets.py` and `web/src/lib/realTargets.test.ts` check: a valid FeatureCollection of 3 to 5 points, all fields filled, longitude in −180 to 180, inside the bbox, on valid elevation and slope cells (slope below 25°), and a mission present in `missions.json`.

## Limits and assumptions

- **The `why` texts are provisional.** Product must rewrite them. They only use facts from the NASA sample table, plus the olivine and carbonate link above.
- **Positions are the rover's, not the exact coring spot.** The waypoint is the last drive before the sample, and the rover often stayed in place for many sols while sampling (for example sol 180 for Rochette, sampled on sols 194 and 196).
- **The delta front cell has a 17° slope.** It is the scarp edge, so a route may avoid it. If the routing threshold rejects it, move the target to the nearest gentler cell.
- **`mission` is the instrument that shows the feature**, not a verified discovery credit. Product should confirm it.
- **The carbonate margin is outside the bbox.** The first Margin Unit samples, Pelican Point (sol 923, 77.35078°E, 18.48344°N) and Lefroy Bay (sol 949, 77.34704°E, 18.48871°N), are 0.5 to 0.7 km west of the bbox edge. Including them needs a bbox of about `[77.34, 18.40, 77.50, 18.50]` (9 km wide), which regenerates `meta.json`, `elevation.bin` and `slope.bin` and changes the cell size to about 17.5 m in x.
- **Not used:** the IAU/USGS Gazetteer and the USGS SIM 3464 geologic units (issue #19, still open). Feature names come from the NASA table.

## Reproduce

```bash
pipeline/.venv/Scripts/python pipeline/export_targets.py --verify
pipeline/.venv/Scripts/python -m pytest pipeline/tests
```
