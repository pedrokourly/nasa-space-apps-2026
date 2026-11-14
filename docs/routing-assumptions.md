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

| Constant | Value | Status | Notes |
|---|---|---|---|
| Speed vs. gradient | `v = speedFlatMS · exp(−3.5 · (|S + 0.05| − 0.05))` | **Reference**, adapted | Tobler's hiking function (Tobler, W. 1993, *Three presentations on geographical analysis and modeling*, NCGIA Technical Report 93-1), normalized so flat terrain gives `speedFlatMS`. Built for people on Earth, not for suited astronauts in 0.38 g |
| `speedFlatMS` | 1.0 m/s | **Assumption** | Suited astronaut on flat terrain |
| `minSpeedMS` | 0.1 m/s | Implementation floor | Avoids dividing by almost zero on steep descents |
| `o2BaseKgPerH` | 0.1 kg/h | **Assumption** | Same value as the 2D Map mock route |
| `o2UphillGain` | 4 | **Assumption** | Consumption × (1 + 4 · uphill gradient) |
| `DEFAULT_O2_AVAILABLE_KG` | 1.0 kg | **Assumption** | About 10 h of walking on flat terrain |
| Mars gravity (0.38 g) | not modeled | Simplification | |

## Verdict and point of no return

Code: `web/src/routing/core/route.ts`.

- The habitat is the route's first point.
- **GO** when the O₂ of the trip, plus the return along the same path if the route does not end at the habitat, fits in the O₂ available.
- **`point_of_no_return`**: index of the first vertex from which the astronaut can no longer get back to the habitat with the O₂ left (turning back the same way or, on a loop, carrying on to the end, whichever is cheaper). The last safe vertex is the one before. It is present exactly when the verdict is NO-GO.
- The optimal return (cheapest path home from any cell) is not computed yet (#40).

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
