# Routing assumptions

Every number the route planner uses to decide the path, the time, the O₂ and the GO / NO-GO verdict. Values marked **assumption** have no scientific reference yet: they are placeholders chosen by the team, to be replaced and cited when a source is found. The code marks the same constants as `ASSUMPTION`.

## Cost of the path (which cells to walk through)

Code: `web/src/routing/core/cost.ts` (`DEFAULT_PROFILE`).

| Constant | Value | Status | Notes |
|---|---|---|---|
| `maxSlopeDeg` | 25° | **Assumption** (team's initial plan) | Cells with slope >= 25° are impassable |
| `sandMultiplier` | 2× | **Assumption** (team's initial plan) | Only applies when Data/GIS ships `sand.bin` (`sand_layer: true`); otherwise no cell is sand |
| `slopeWeight` | 2 | **Assumption** (ours), checked on the real grid | Cost factor = 1 + 2 · (slope / 25°)². See "Calibration on the real grid" below |
| No-data cells | impassable | Rule (`AGENTS.md`) | Never treated as zero or flat. Values of magnitude >= 1e30 also count as no data (the HiRISE DTM uses −3.4028226550889045e+38) |

## Walking speed and O₂

Code: `web/src/routing/core/walk.ts` (`DEFAULT_WALK`, `DEFAULT_O2_AVAILABLE_KG`).

The O₂ comes from the energy the body spends, not from distance or time directly:

```
gradient → speed (Tobler) → metabolic power in watts (Pandolf, scaled to Mars gravity)
         → energy (watts × seconds) → O₂ (about 20.1 kJ per liter, 1.429 g per liter)
```

| Step | Formula / value | Status | Source and notes |
|---|---|---|---|
| Speed vs. gradient | `v = speedFlatMS · exp(−3.5 · (\|S + 0.05\| − 0.05))` | **Reference**, adapted | Tobler, W. (1993), *Three presentations on geographical analysis and modeling*, NCGIA Technical Report 93-1. Normalized so flat terrain gives `speedFlatMS`. Fitted to hikers on Earth, not suited astronauts |
| `speedFlatMS` | 1.0 m/s | **Assumption** | Suited pace on flat ground (Tobler gives 1.4 m/s unsuited) |
| `minSpeedMS` | 0.1 m/s | Implementation floor | Avoids dividing by almost zero on steep descents |
| Metabolic power | `M = 1.5·W + f·[2.0·(W+L)·(L/W)² + η·(W+L)·(1.5·V² + 0.35·V·G)]` (W) | **Reference**, adapted | Pandolf, K. B., Givoni, B. & Goldman, R. F. (1977), *Predicting energy expenditure with loads while standing or walking very slowly*, J. Appl. Physiol. 43(4):577–581. W, L in kg; V in m/s; G in percent; η terrain factor. `f` is our gravity scaling (below) |
| `bodyMassKg` (W) | 75 kg | **Assumption** | Astronaut |
| `loadMassKg` (L) | 90 kg | **Assumption** | Suit + life-support backpack, order of the Apollo A7L with PLSS (not verified). Heavier than Pandolf's fitted loads: an extrapolation |
| `terrainFactor` (η) | 1.1 | **Assumption** | Pandolf's "dirt road" for packed regolith (paved 1.0, loose sand 2.1) |
| `gravityRatio` (f) | 3.721 / 9.80665 ≈ 0.379 | **Assumption** (first-order) | Multiplies the load and walking terms, not the standing term (mostly the body's own upkeep). Not a measured Mars law: stiff pressurized joints cost energy at any gravity, so real costs may be higher |
| Downhill | grade term clamped at 0 | **Assumption** (conservative) | Pandolf has no downhill data; a descent costs at least flat walking at the same speed. A published downhill correction exists (Pimental & Pandolf 1979; Santee et al. 2003) but is not used |
| Energy → O₂ | 20.1 kJ per liter of O₂; 1.429 g per liter | **Reference** | Energy equivalent of oxygen for a mixed diet, ≈ 4.8 kcal/L (indirect calorimetry, Weir 1949); O₂ density at 0 °C and 1 atm |
| Result on flat ground | ≈ 396 W, ≈ 0.10 kg O₂/h | Derived | |
| Sanity check | Apollo lunar EVAs: 822 to 1267 kJ/h ≈ 230 to 350 W per crew member | **Reference** | Waligora, J. M. et al. (1975), *Apollo experience report: assessment of metabolic expenditures*, NASA TN D-7883. Our flat-walking power is above that range, so the O₂ estimate errs on the safe side |
| `DEFAULT_O2_AVAILABLE_KG` | 1.0 kg | **Assumption** | About 10 h of flat walking with this model |

On a 10% climb the model slows to 0.70 m/s and spends 514 W, i.e. about 1.8× more O₂ per meter than on flat ground.

## Verdict and point of no return

Code: `web/src/routing/core/route.ts`, `returnField.ts`.

- **The habitat** is the `habitat` feature of `targets.geojson` (#69): the app passes it to the route Worker. When it is missing, outside the grid or on an impassable cell, the route's first point is the habitat instead.
- **O₂ budget, assumption:** the O₂ is counted from the route's first point, with the full supply at departure, even when that point is not the habitat. In other words, the astronaut is taken to start the route fully supplied wherever it starts.
- **Optimal return:** one backward Dijkstra from the habitat gives, for every cell, the least O₂ needed to walk back home over passable cells, with the same walking model and step lengths as the route. Walking is direction-dependent: coming home uphill costs more than going out downhill. It is cached per habitat (~200 ms the first time on the 512 × 512 grid).
- **GO** when the O₂ of the trip plus the optimal return from its last point to the habitat (zero when it ends at the habitat) fits in the O₂ available.
- **`point_of_no_return`**: index of the first vertex where the O₂ already spent plus the optimal return to the habitat exceeds what is available. The last safe vertex is the one before. It is present exactly when the verdict is NO-GO: going home through the next vertex is always an option (for any fixed habitat cell), so spent + home never decreases along the route.
- **`start_unreachable`**: when `point_of_no_return` is 0, even the start cannot reach the habitat with the O₂ available (or has no way home at all). The route carries `start_unreachable: true`, no return is drawn and the route summary says "Start is too far from the habitat for the available O₂".
- **`return_path`** (the dashed amber line): the optimal return traced over the same field, from vertex `from_vertex` to the habitat. On a GO route it starts at the last vertex (none when the route ends at the habitat). On a NO-GO route it starts at the last STOP reached before the point of no return (the start or a requested point), not at the last safe vertex, so the astronaut turns back at a planned stop and keeps an O₂ margin; the O₂ of the route up to that stop plus the O₂ of the return fits in what is available (checked by `core/habitatReturn.test.ts`). The map draws the route after that vertex in muted grey.
- **`return_to_start`** (the dotted violet line): when the route does not start at the habitat cell, a second, independent verdict with the same rules against the route's first point. A second return field is built from the start cell (same cache), GO when the trip plus the optimal return from its last point to the start fits in the O₂ available, its own `point_of_no_return` (always ≥ 1, since the start costs nothing to reach from itself) and its own `return_path` to the start cell, from the last vertex on GO or from the last stop before its `point_of_no_return` on NO-GO (none when that stop is the start itself) (checked by `core/startReturn.test.ts`). The two verdicts can disagree: a trip that ends near the habitat can be GO for the habitat and NO-GO for the start, and the other way round. With both verdicts, the map mutes only the part after the LATER of the two points of no return, and only when both are NO-GO: before that vertex at least one way back still fits in the O₂. The route summary shows one line per verdict ("Habitat" and "Start"), each with its own turn-back distance and return estimate.
- **`legs`**: one entry per pair of consecutive requested points, with distance, time and O₂; they add up to the totals.

## Calibration on the real grid (#39)

Measured on `web/public/data/` (MRO/HiRISE DTM resampled to 512 × 512 by the Data/GIS pipeline), from the habitat `[77.4508, 18.4447]` to each of the three mock targets:

| `slopeWeight` | Habitat → delta front | Habitat → carbonate margin | Habitat → third target |
|---|---|---|---|
| 0 (distance only) | max slope 19.9°, mean 3.2° | max 22.9°, mean 4.6° | max 9.7°, mean 3.6° |
| 1, 2, 4 | max 6.4°, mean 1.9° | max 22.9°, mean 3.0° | max 6.2°, mean 2.1° |
| 8 | same as above | max 22.9°, mean 3.0° (+7 m) | same as above |

- Paths are 4% to 10% longer than the straight line in every case, so the slope term costs almost no distance.
- Any weight from 1 to 8 gives the same paths, so **2 stays**: the result is not sensitive to this guess. With 0 the route climbs slopes up to ~20° to save a few meters.
- The 22.9° on the carbonate leg is the target itself: the mock "Carbonate margin" point sits on a ~19° slope next to cells of 27° to 29°, so the last ~10 cells have to climb. Worth telling Product/Data/GIS when they place the real targets (#28).
- Grid facts: no elevation holes; slope no-data only on the 1-cell border; max slope 43.7°; 0.46% of cells at >= 25°, 1.2% at >= 20°.
- Demo loop (habitat, 3 targets, habitat): 12.7 km, 3.8 h, 0.42 kg O₂, GO, computed in ~60 ms in Node.

The slope comes from the 15 m grid, which underestimates steps of a few meters (Data/GIS measured 0.78% of 1 m pixels above 25°). A stricter "safest" mode could use a max-per-cell slope file later.

## Grid format expected from Data/GIS

Code: `web/src/routing/core/grid.ts`, `gridBinary.ts`. Contract: `AGENTS.md`, section 5.

- `elevation.bin` in meters and `slope.bin` in **degrees** (confirmed: `pipeline/export_slope.py`, Horn method with the real meters per cell), Float32 little-endian, row-major, row 0 = north.
- Cell values are area samples: the center of cell (col, row) sits half a cell inside the `bbox`.
- Data/GIS computes the slope on the 15 m grid (documented as an assumption in `docs/terrain-data.md`). A max-per-cell slope from the 1 m DTM would be more conservative.

## Final demo scenario (numbers for the pitch)

Computed by `route()` over the real grid and the real targets (`web/public/data/targets.geojson`), with the default assumptions above (1.0 kg of O₂ available). Kept honest by `web/src/routing/realGrid.test.ts`.

| Leg | Distance | Time | O₂ |
|---|---|---|---|
| Habitat → Artuby ridge | 1.00 km | 17 min | 0.030 kg |
| Artuby ridge → Séítah | 0.22 km | 4 min | 0.008 kg |
| Séítah → delta front | 2.57 km | 47 min | 0.088 kg |
| Delta front → upper fan | 1.46 km | 30 min | 0.060 kg |
| Upper fan → habitat | 4.26 km | 70 min | 0.124 kg |
| **Whole loop** | **9.51 km** | **2.8 h** | **0.31 kg, GO** |

- With half the O₂ the loop needs, the verdict is NO-GO and the route marks the point of no return.
- The route is computed in the browser in about 0.2 s the first time (grid download and return field) and about 10 ms afterwards.
- The delta front target sits on a 17° slope (the limit is 25°): the steepest arrival of the walk.

## Sources and libraries

Data:

- **Terrain:** Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic, MRO/HiRISE, 1 m, USGS Astrogeology Science Center, published 2020-07-24, https://doi.org/10.5066/P9REJ9JN. Resampled to the 512 × 512 routing grid by the Data/GIS pipeline; details and citation in `docs/terrain-data.md`.
- **Targets:** `web/public/data/targets.geojson`; sources in `docs/targets.md`.

Published references used by the model:

- Tobler, W. (1993). *Three presentations on geographical analysis and modeling*. NCGIA Technical Report 93-1. (walking speed vs. gradient)
- Pandolf, K. B., Givoni, B. & Goldman, R. F. (1977). Predicting energy expenditure with loads while standing or walking very slowly. *Journal of Applied Physiology*, 43(4), 577–581. (metabolic power)
- Weir, J. B. de V. (1949). New methods for calculating metabolic rate with special reference to protein metabolism. *Journal of Physiology*, 109, 1–9. (energy per liter of O₂)
- Waligora, J. M. et al. (1975). *Apollo experience report: assessment of metabolic expenditures*. NASA TN D-7883. (sanity check: 822 to 1267 kJ/h on lunar EVAs)
- Hart, P. E., Nilsson, N. J. & Raphael, B. (1968). A formal basis for the heuristic determination of minimum cost paths. *IEEE Transactions on Systems Science and Cybernetics*, 4(2), 100–107. (A*)
- Dijkstra, E. W. (1959). A note on two problems in connexion with graphs. *Numerische Mathematik*, 1, 269–271. (optimal return field; reference for the A* tests)
- Mars mean radius 3389.5 km for distances (`web/src/lib/mars-geo.ts`); Mars surface gravity 3.721 m/s².

Libraries: the routing core has **no runtime dependency**; it is plain TypeScript and uses only the project's own `haversine`. Development and tests use TypeScript, Vite and Vitest (versions in `web/package.json`, all open source).
