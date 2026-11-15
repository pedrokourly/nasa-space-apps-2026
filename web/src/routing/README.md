# Routing

All constants and their sources: [`docs/routing-assumptions.md`](../../../docs/routing-assumptions.md).

## Structure

- `core/`: pure logic (grid, cost, A*, metrics, `route()`). **Do not** import React, Leaflet, the DOM or Worker APIs; it runs in the browser, in the Worker and in Node.
- `api.ts`, `client.ts`, `route.worker.ts`, `useRouting.ts`, `RouteController.tsx`: glue with the app (Worker, discarding stale requests, React). Maintained by the 2D Map workstream; the plug point for the real `route()` is `routeImpl` in `route.worker.ts`.
- Distance: always `haversine` from `src/lib/mars-geo.ts` (R = 3389.5 km).

## Grid format

Based on `Meta` in `src/types/contract.ts` and section 5 of `AGENTS.md`.

| Item | Format |
|---|---|
| `elevation.bin` | Float32 little-endian, row-major, meters |
| `slope.bin` | Float32 little-endian, row-major, **degrees** (confirmed by `pipeline/export_slope.py`); the 1-cell border is no data |
| Row 0 | North edge (`meta.row0 = 'north'`) |
| Longitude | −180 to 180 |
| Cell | Area sample: the center of (col, row) sits half a cell inside the `bbox` |
| No data | `meta.nodata`, non-finite or magnitude >= 1e30; never treated as zero |
| Sand | Optional `sand.bin` (Uint8, 1 = sand), read only when `meta.sand_layer` is `true` (contract, section 5) |

Confirmed against the real files from Data/GIS (`docs/terrain-data.md`). Still open: whether a sand layer will exist. Only the loader knows the `.bin` format; everything else uses `Grid` (`core/grid.ts`).

## Tests

```bash
cd web && npm test
```

## Cost model (S1)

`core/cost.ts` (profile in `DEFAULT_PROFILE`) and `core/astar.ts`.

| Rule | Value | Source |
|---|---|---|
| Slope >= 25° | impassable | Team's initial plan (project assumption) |
| No-data cell (elevation or slope) | impassable | `AGENTS.md` rule: nodata never becomes zero |
| Sand | cost × 2 | Team's initial plan (project assumption) |
| Slope term | factor = 1 + 2 · (slope / 25°)² | **Our hypothesis**, no scientific reference; calibrate with real data |

- Step cost = step meters × average factor of the two cells. Every factor is >= 1, so the straight-line distance in meters is an admissible heuristic and A* is optimal.
- 8 neighbors; a diagonal move is only allowed if both orthogonal cells beside it are free (it does not cut the corner of an obstacle).
- `findPathDijkstra` is the reference used in tests to check A*.
- Route modes (shortest, safest) will be another `CostProfile`, with no change to the data files.

## Metrics and `route()` (S2)

`core/walk.ts` and `core/route.ts`. `route(grid, points, options)` returns the contract GeoJSON (`Route`); `createRouter(grid, options)` returns `(points) => Route`, the shape the Worker uses (`RouteFn`, S3).

| Item | Value | Source |
|---|---|---|
| Speed by slope | Tobler (1993), normalized: flat = 1.0 m/s (**assumption**) | Published reference, fitted on Earth hikers |
| Metabolic power | Pandolf et al. (1977), load and walking terms × g_Mars / g_Earth | Published reference; the gravity scaling is our first-order **assumption** |
| Masses, terrain | astronaut 75 kg, suit + backpack 90 kg, η = 1.1 | **Assumptions** |
| Energy → O₂ | 20.1 kJ per liter of O₂, 1.429 g per liter | Indirect calorimetry (Weir 1949) |
| Flat walking | ≈ 396 W, ≈ 0.10 kg O₂/h | Above the Apollo EVA range (230 to 350 W, NASA TN D-7883): conservative |
| O₂ available at departure | 1.0 kg (`o2_available_kg` option) | **Assumption** |

- Vertices are cell centers; distance uses `haversine` (R = 3389.5 km).
- **Verdict:** GO if the O₂ of the trip plus the optimal return from its last point (`core/returnField.ts`, least O₂ home from every cell) fits in what is available. For a loop (habitat → targets → habitat) the O₂ of the trip is enough.
- **Point of no return** (`point_of_no_return`, vertex index): first vertex from which the astronaut can no longer get back to the habitat with the O₂ left, by the least-O₂ way home. The last safe vertex is the one before. Present exactly when the verdict is NO-GO.
- **Legs** (`legs`, S5): one per pair of consecutive points, with `from_vertex`, `to_vertex`, `dist_m`, `time_s`, `o2_kg`; they add up to the totals.
- Errors: `OutOfGridError` (point outside the grid), `BlockedPointError` (point on an impassable cell), `NoPathError` (no path), `Error` (fewer than 2 points). See "Response states" below.
- Points in the same cell give a valid zero-length route (two equal vertices).
- The available O₂ is **not** part of the route (the contract has no such field). If the UI needs to show the margin, that is a contract change (update section 5 of `AGENTS.md` in the same PR).

### EVA parameters (issue #61)

The planner can tune three inputs, held in the store as `evaParams` (`setEvaParams` clamps them) and sent with every route request (`RouteRequest.params` → worker → `createRouter`). Changing them recomputes the route like moving a waypoint (stale responses are discarded). The Route contract is unchanged.

| Parameter | Default | Allowed range | Source |
|---|---|---|---|
| `speedFlatMS` (m/s) | 1.0 | 0.2 to 2 | **Assumption** |
| `loadMassKg` (kg): suit, backpack and gear; drives the O₂ rate through the metabolic model | 90 | 40 to 150 | **Assumption** |
| `o2_available_kg` (kg) | 1.0 | 0.1 to 5 | **Assumption** |

Presets (`evaPresets.ts`: Nominal, Conservative, Heavy load) are invented for the demo. **None of these values, ranges or presets has a scientific reference yet**; replace them and cite the source when one is found.

### Sample routes

`public/data/mock/route-go.geojson` and `route-no-go.geojson`: the same trip (habitat, 3 mock targets, habitat) over an invented terrain with the mock bbox, one with the default O₂ (GO) and one with 0.2 kg (NO-GO, with `point_of_no_return`). Flagged `mock: true`. Regenerate with `WRITE_MOCKS=1 npm test -- sampleRoutes`.

## Worker (S3)

- `route.worker.ts` runs the real `route()` (via `createRouter`). On the first request it loads the grid with `loadGrid(GRID_BASE_URL)`: `meta.json`, `elevation.bin` and `slope.bin` from `data/` (the real Jezero grid, S4). If loading fails, the next request tries again.
- `core/gridBinary.ts` decodes the `.bin` files (Float32 LE via `DataView`) and checks sizes and `bbox`; `meta.json` is validated by `parseMeta`.
- `public/data/mock/elevation.bin` and `slope.bin` are the **invented** sample terrain (1 MiB each, 512 × 512) used by tests and the sample routes. They do not match the imagery and the app no longer uses them.
- `realGrid.test.ts` checks the real grid in `public/data/` (geometry, units, holes, demo loop GO in under 1 s). Calibration results: `docs/routing-assumptions.md`.
- Discarding stale requests and debouncing stay in `client.ts` / `useRouting.ts` (2D Map workstream).

## Response states (S6, frozen)

`RouteResponse` in `api.ts` is the Worker's output format. It has four states and is frozen: adding one is a contract change. `respond.ts` builds it (`answerRoute`, never throws) and rebuilds the error on the main thread (`errorFromResponse`). `message` is written for the user and the status line shows it as is; only the `error` state gets a "Route error:" prefix (`routeErrorText`).

| State | When | Example file (`public/data/mock/`) | Message |
|---|---|---|---|
| `ok: true` | Route found | `response-ok.json` | (the route) |
| `no-path` | No walkable path between two points | (test only) | "No possible path between the points" |
| `no-path` + `point_index` | A point sits on impassable terrain: slope >= 25° or no data, including the 1-cell border of the grid | `response-no-path.json` | "Stop 1 is on impassable terrain (too steep or no data). Move it." |
| `out-of-grid` + `point_index` | A point outside the grid `bbox` (the map already refuses these clicks) | `response-out-of-grid.json` | "Stop 1 is outside the EVA planning area. Move it inside the rectangle." |
| `error` | Anything else, e.g. the grid failed to load | `response-error.json` | "Route error: Failed to load …" |

`point_index` is the index in the requested points: 0 is the start, N is "Stop N", as on the map. The example files are generated from the real code and kept in sync by `respond.test.ts` (regenerate with `WRITE_MOCKS=1 npm test -- respond`).
