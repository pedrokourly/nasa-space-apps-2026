# Routing assumptions

Every number the route planner uses to decide the path, the time, the O₂ and the GO / NO-GO verdict. Values marked **assumption** have no scientific reference yet: they are placeholders chosen by the team, to be replaced and cited when a source is found. The code marks the same constants as `ASSUMPTION`.

## Cost of the path (which cells to walk through)

Code: `web/src/routing/core/cost.ts` (`DEFAULT_PROFILE`).

| Constant | Value | Status | Notes |
|---|---|---|---|
| `maxSlopeDeg` | 25° | **Assumption** (team's initial plan) | Cells with slope >= 25° are impassable |
| `sandMultiplier` | 2× | **Assumption** (team's initial plan) | Only applies when Data/GIS ships `sand.bin` (`sand_layer: true`); otherwise no cell is sand |
| `slopeWeight` | 2 | **Assumption** (ours) | Cost factor = 1 + 2 · (slope / 25°)². Calibrate with the real grid (#39) |
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

## Grid format expected from Data/GIS

Code: `web/src/routing/core/grid.ts`, `gridBinary.ts`. Contract: `AGENTS.md`, section 5.

- `elevation.bin` in meters and `slope.bin` in **degrees**, Float32 little-endian, row-major, row 0 = north. Degrees still to be confirmed by Data/GIS.
- Cell values are area samples: the center of cell (col, row) sits half a cell inside the `bbox`.
- When reducing the 1 m DTM to the app grid, keep the **maximum** (or the 90th percentile) slope of each block, not the mean: the mean hides short steep steps.
