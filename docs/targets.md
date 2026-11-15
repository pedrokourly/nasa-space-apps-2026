# Science targets of Jezero

Source of `web/public/data/targets.geojson` (issue #28), built by `pipeline/export_targets.py`.

## How the targets were chosen

- The EVA story needs a start point (the habitat) and 3 to 4 places worth visiting, all **inside the grid bbox** `[77.32, 18.40, 77.50, 18.50]` and on a valid elevation and slope cell. The demo visits 3 or 4 of the targets; the file offers 5 so the astronaut can choose.
- Every science target is a place where Perseverance cored a rock sample, so each one has an official name, a sol and a rock type.
- The set mixes igneous crater-floor rock, olivine-rich Séítah rock, the delta front, the top of the delta and the carbonates of the margin unit, which also gives the route a flat leg, a steep edge and long climbs.

## Where each coordinate comes from

1. **Sample names, sols, features and sampling locations:** the official NASA table [Mars Rock Samples](https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/) (read on 2026-11-14).
2. **Position:** the Perseverance waypoints published by NASA on MMGIS, `https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json` (fields `sol`, `lon`, `lat`, `elev_geoid`, read on 2026-11-14). A target uses the last waypoint at or before the sample sol, rounded to 5 decimals (about 1 m).
3. **Landing site:** the first waypoint (sol 13) agrees with [Wikidata Q105824100](https://www.wikidata.org/wiki/Q105824100) and with NASA GISS [Mars24](https://www.giss.nasa.gov/tools/mars24/help/landers.html) (77.45°E, 18.44°N).

`python pipeline/export_targets.py --verify` downloads the waypoints again and checks that the pinned coordinates still match.

| id | lon, lat | Waypoint sol | Samples (official table) | Cell (row, col) | Elevation | Slope | Straight line from habitat |
|---|---|---|---|---|---|---|---|
| `habitat` | 77.45089, 18.44463 | 13 | Landing site | 283, 372 | −2569.9 m | 0.6° | 0 km |
| `artuby-ridge` | 77.44437, 18.43074 | 180 | Montdenier (sol 194), Montagnac (sol 196), feature Rochette | 354, 353 | −2574.5 m | 0.8° | 0.90 km |
| `seitah` | 77.44302, 18.43396 | 248 | Salette (sol 262), Coulettes (sol 271), feature Brac, South Séítah | 338, 349 | −2569.7 m | 3.5° | 0.77 km |
| `delta-front` | 77.40617, 18.45890 | 477 | Swift Run (490), Skyland (495) at Skinner Ridge; Hazeltop (509), Bearwallow (516) at Wildcat Ridge | 210, 245 | −2521.8 m | 13.8° | 2.65 km |
| `upper-fan` | 77.38407, 18.47020 | 736 | Melyn (sol 749), feature Berea, Upper Fan | 152, 182 | −2449.2 m | 3.1° | 4.04 km |
| `margin-carbonates` | 77.32720, 18.49183 | 1084 | Comet Geyser (sol 1088), feature Bunsen Peak, Margin Unit, silica-cemented carbonate | 41, 20 | −2383.8 m | 6.3° | 7.48 km |

Elevation and slope are read from `elevation.bin` and `slope.bin`. The farthest target is 7.5 km from the habitat and 186 m above it; the full loop through all five science targets is about 16.6 km and the routing model still returns GO with its default O₂ (see `web/src/routing/realGrid.test.ts`).

## Missions

`mission` points to an entry of `missions.json`. Here it means the MRO instrument whose data shows or revealed the feature:

- `mro-hirise` for the habitat, Artuby Ridge, the delta front and the upper fan: all are visible on the HiRISE basemap, which is also the source of the terrain model (`docs/terrain-data.md`).
- `mro-crism` for Séítah and for the margin unit carbonates: MRO's CRISM mapped olivine and carbonate-bearing rock across the Jezero region before landing (Brown et al., 2020). The text says only that, and that Séítah is where the rover sampled olivine-rich rock up close. It does not claim that the orbital signal comes from Séítah itself. For the margin unit, the strongest carbonate signal in Jezero comes from orbital reflectance spectroscopy (Herd 2025).

## Sources of the `why` texts

Each claim was checked against a source read on 2026-11-15. The main one is Herd, C. D. K. et al. (2025), *Sampling Mars: Geologic context and preliminary characterization of samples collected by the NASA Mars 2020 Perseverance Rover Mission*, PNAS 122(2), e2404255121, [doi:10.1073/pnas.2404255121](https://doi.org/10.1073/pnas.2404255121), called "Herd 2025" below.

| Target | Claim in the text | Source |
|---|---|---|
| `habitat` | Octavia E. Butler landing site, Perseverance touched down on the crater floor | NASA GISS Mars24 and [Wikidata Q105824100](https://www.wikidata.org/wiki/Q105824100) for the position; Herd 2025 for the crater floor |
| `habitat` | The 1 m terrain behind the routes comes from MRO's HiRISE camera | USGS product page, DOI 10.5066/P9REJ9JN (`docs/terrain-data.md`) |
| `artuby-ridge` | 2 to 3 m cliff of Máaz formation rock along Artuby Ridge | Herd 2025, figure caption of the crater floor sample contexts |
| `artuby-ridge` | Igneous rocks, likely lava flows | Herd 2025: all crater floor outcrops investigated are igneous, likely emplaced as lava flows |
| `artuby-ridge` | Cored Montdenier and Montagnac (Rochette) | NASA [Mars Rock Samples](https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/) |
| `artuby-ridge` | Less than 1 km from the habitat | Haversine on the two coordinates (0.90 km) |
| `seitah` | Possibly the oldest crater floor rock; coarse, layered, olivine-dominated; likely from a thick lava flow, laccolith or lava lake | Herd 2025 (Séítah described as potentially the oldest, and as an olivine-dominated cumulate likely from a thick lava flow, laccolith or lava lake) |
| `seitah` | Cored Salette and Coulettes at Brac | NASA Mars Rock Samples; Herd 2025 says they were collected further into the unit |
| `seitah` | CRISM mapped olivine in the region from orbit | Brown, A. J. et al. (2020), *Olivine-Carbonate Mineralogy of the Jezero Crater Region*, JGR Planets, [doi:10.1029/2019JE006011](https://doi.org/10.1029/2019JE006011) |
| `delta-front` | Jezero held a delta-lake system with high potential to preserve signs of past life | Herd 2025 (abstract) |
| `delta-front` | Layered sedimentary rock cored at Skinner Ridge and Wildcat Ridge (Hawksbill Gap) | Herd 2025, sample table (Swift Run and Hazeltop: horizontally layered, Shenandoah formation); NASA Mars Rock Samples for Skyland and Bearwallow |
| `upper-fan` | Records the latest stages of water in the crater and has some of the coarsest sediments so far | Herd 2025, Upper Fan section |
| `upper-fan` | Melyn cored at Berea from alternating sandstone and coarser layers | Herd 2025 (Tenby formation); NASA Mars Rock Samples |
| `upper-fan` | About 120 m above the habitat | Our `elevation.bin`: −2,449 m at the target and −2,570 m at the habitat |
| `margin-carbonates` | The margin unit sits beside the western crater rim, and its strong carbonate signal comes from orbital reflectance spectroscopy | Herd 2025, Margin unit section |
| `margin-carbonates` | Proposed to be an ancient lake shoreline deposit | Herd 2025: proposed, with alternative hypotheses (pyroclastic, igneous, fluviolacustrine or aeolian deposits), so the text says "has been proposed" |
| `margin-carbonates` | Cored Comet Geyser, a silica-cemented carbonate | NASA Mars Rock Samples (rock type of sample 24, feature Bunsen Peak) |

## Checks

- Each target falls on the feature it describes when drawn over the Mars Trek HiRISE 25 cm tiles: the delta front sits at the foot of the delta scarp, the upper fan on top of the delta, and Séítah and Artuby Ridge on the contact between the smooth Máaz plains and the rippled Séítah terrain. This was an inspection by eye on a test page, not an automated test.
- `pipeline/tests/test_export_targets.py` and `web/src/lib/realTargets.test.ts` check: a valid FeatureCollection of 3 to 6 points, all fields filled, longitude in −180 to 180, inside the bbox, on valid elevation and slope cells (slope below 25°), and a mission present in `missions.json`.

## Limits and assumptions

- **The `why` texts are sourced but can still be polished.** Every fact is tied to a source above, so Product can change the wording but must keep the facts. The texts are not peer-reviewed by a planetary scientist.
- **Positions are the rover's, not the exact coring spot.** The waypoint is the last drive before the sample, and the rover often stayed in place for many sols while sampling (for example sol 180 for Rochette, sampled on sols 194 and 196).
- **The delta front cell has a 14° slope.** It is the scarp edge, so a route may avoid it. If the routing threshold rejects it, move the target to the nearest gentler cell.
- **`mission` is the instrument that shows the feature**, not a verified discovery credit. Product should confirm it.
- **More samples could still be added.** The Margin Unit has two earlier samples just east of Comet Geyser, Pelican Point (sol 923, 77.35078°E, 18.48344°N) and Lefroy Bay (sol 949, 77.34704°E, 18.48871°N), both inside the bbox. The upper fan also has Otis Peak (sol 832) and Pilot Mountain (sol 913, the same stop as Pelican Point), both inside the bbox. Adding more targets means choosing them for the story, not for the data.
- **Not used:** the IAU/USGS Gazetteer and the USGS SIM 3464 geologic units (issue #19, still open). Feature names come from the NASA table.

## Reproduce

```bash
pipeline/.venv/Scripts/python pipeline/export_targets.py --verify
pipeline/.venv/Scripts/python -m pytest pipeline/tests
```
