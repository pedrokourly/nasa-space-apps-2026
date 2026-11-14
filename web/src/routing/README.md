# Routing

## Structure

- `core/`: pure logic (grid, cost, A*, metrics, `route()`). **Do not** import React, Leaflet, the DOM or Worker APIs; it runs in the browser, in the Worker and in Node.
- `api.ts`, `client.ts`, `route.worker.ts`, `useRouting.ts`, `RouteController.tsx`: glue with the app (Worker, discarding stale requests, React). Maintained by the 2D Map workstream; the plug point for the real `route()` is `routeImpl` in `route.worker.ts`.
- Distance: always `haversine` from `src/lib/mars-geo.ts` (R = 3389.5 km).

## Grid format (assumptions until Data/GIS confirms)

Based on `Meta` in `src/types/contract.ts` and section 5 of `AGENTS.md`.

| Item | Assumption |
|---|---|
| `elevation.bin` | Float32 little-endian, row-major, meters |
| `slope.bin` | Float32 little-endian, row-major, **degrees** (assumption) |
| Row 0 | North edge (`meta.row0 = 'north'`) |
| Longitude | −180 to 180 |
| Cell | Area sample: the center of (col, row) sits half a cell inside the `bbox` |
| No data | `meta.nodata` or `NaN`; never treated as zero |
| Sand | Optional `sand` layer (1 = sand). **Not in the contract**; depends on Data/GIS |

Open questions for Data/GIS: are the byte order and nodata confirmed? Is the slope in degrees? Will there be a sand layer? Is `bbox` `[lonMin, latMin, lonMax, latMax]`? Only the loader (real data) knows the `.bin` format; everything else uses `Grid` (`core/grid.ts`).

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
| Speed by slope | Tobler (1993), normalized: flat = `speedFlatMS` | Published reference; uses the signed gradient between vertices |
| Flat speed | 1.0 m/s | **Assumption** (suited astronaut) |
| O₂ consumption on flat terrain | 0.1 kg/h | **Assumption** (same value as the 2D Map mock) |
| O₂ increase when climbing | × (1 + 4 · gradient) | **Assumption** |
| O₂ available at departure | 1.0 kg (`o2_available_kg` option) | **Assumption**, ~10 h on flat terrain |
| Mars gravity (0.38 g) | not modeled | Simplification |

- Vertices are cell centers; distance uses `haversine` (R = 3389.5 km).
- **Verdict:** GO if the O₂ of the trip, plus that of the return along the same path when the last point is not the first, fits in what is available. For a loop (habitat → targets → habitat) the O₂ of the trip is enough.
- **Point of no return** (`point_of_no_return`, vertex index): first vertex where the O₂ already spent plus that of the way back along the same path exceeds what is available; absent if that never happens. The optimal return is S5's.
- Errors: `OutOfGridError` (point outside the grid), `NoPathError` (no path), `Error` (fewer than 2 points).
- The available O₂ is **not** part of the route (the contract has no such field). If the UI needs to show the margin, that is a contract change (update section 5 of `AGENTS.md` in the same PR).

### Sample routes

`public/data/mock/route-go.geojson` and `route-no-go.geojson`: the same trip (habitat, 3 mock targets, habitat) over an invented terrain with the mock bbox, one with the default O₂ (GO) and one with 0.2 kg (NO-GO, with `point_of_no_return`). Flagged `mock: true`. Regenerate with `WRITE_MOCKS=1 npm test -- sampleRoutes`.

## Worker (S3)

- `route.worker.ts` runs the real `route()` (via `createRouter`). On the first request it loads the grid with `loadGrid(GRID_BASE_URL)`: `meta.json`, `elevation.bin` and `slope.bin` from `data/mock/` (same source as `loadData('mock')` in `App.tsx`). If loading fails, the next request tries again.
- `core/gridBinary.ts` decodes the `.bin` files (Float32 LE via `DataView`) and checks sizes and `bbox`; `meta.json` is validated by `parseMeta`.
- `public/data/mock/elevation.bin` and `slope.bin` are the **invented** sample terrain (1 MiB each, 512 × 512): rolling hills and an impassable crater between the habitat and the delta front. They do **not** match the imagery; S4 (#39) swaps them for the real Jezero grid by changing `GRID_BASE_URL`.
- Discarding stale requests and debouncing stay in `client.ts` / `useRouting.ts` (2D Map workstream). Errors: `NoPathError` → `no-path`; anything else (e.g. `OutOfGridError`) → `error` with its message.
