# Mars Route Planner (MRP) · Jezero

Our entry for the NASA Space Apps 2026 challenge "Interplanetary Survival Guide: Martian Map".

Mars Route Planner is a Marswalk (EVA) planner for Jezero crater. It shows a layered 2D map built from several NASA missions and computes a safe walking route over the real terrain. An O₂ budget gives a GO / NO-GO verdict and the point of no return. The same EVA can be replayed on the 2D map or in a 3D view. The app is fully static, with no backend.

**Live demo:** https://martian-map.pedrokourly.dev

## What it does

### Planning (2D map)

- **Layered map of Jezero.** The base is MRO CTX and HiRISE, from NASA Mars Trek. The tool bar toggles Mars Odyssey THEMIS (daytime infrared), MGS MOLA (elevation) and a slope layer from the HiRISE DTM. Every layer shows its mission, instrument, resolution and date. The color legends of the active layers stack above the Recenter button.
- **Route.** Click the map to set the start point, then the stops. An A* search runs in a Web Worker over a 512 × 512 terrain grid (about 20 × 12 m per cell). It avoids slopes of 25° and more and prefers gentle ground. Distances use the Mars radius (3389.5 km).
- **Manage steps and Best order.**
  - *Manage steps* removes single stops or clears the route.
  - *Best order* reorders the stops to use the least O₂, counting the way home, and adds no return point.
  - The best order is exact up to 8 stops (brute force over every order). Above 8 it comes from a heuristic, and the app says the order is not guaranteed to be the best. Either way, it never needs more O₂ than the click order.
- **Plans table.** The route card lists the planned route, the return to the habitat and the return to the start.
  - Each row shows the distance, time, O₂ used and O₂ left, with its own verdict.
  - The better of the two ways home is highlighted in green.
  - On NO-GO, the card shows the point of no return and the return from the last safe stop.
- **O₂ budget.**
  - The suit carries 0.73 kg of O₂, the primary O₂ of NASA's lunar EMU PLSS design (1.6 lbm, NASA NTRS 20160002044).
  - 10% is kept as a safety reserve, so a plan is GO only if the astronaut gets back with at least 10% left.
  - The O₂ use comes from a metabolic walking model (Pandolf) scaled to Mars gravity, with Tobler's walking speed.
- **EVA simulation.** *Select route* picks the plan (planned route, return to habitat or return to start), and *Start EVA* walks it. The metrics bar shows O₂ used and left, the elapsed time, the distance walked and the elevation gain.
- **Shareable plans.** The route is kept in the URL (`#route=lon,lat;lon,lat…`).

### 3D view

- CesiumJS with the Cesium Mars terrain (relief × 3). It draws the route, colored by slope, the ways back and the part already walked.
- It has the same *Select route* + *Start EVA* dock as the 2D map. *Follow astronaut* makes the camera follow the astronaut during the EVA.

### Conditions

- The last MEDA (Perseverance) data available, sol 1859. It shows air temperature (°C, K or °F, always with the source value in kelvin), surface pressure and relative humidity, with min, mean and max.
- Wind and dust show as unavailable, with the reason from the data file.
- The screen also covers the terrain model, the recent sols, the science targets with the mission that revealed each one, and the map layers. It is never shown as live data.

### Honesty of the numbers

Distance and slope are computed from NASA terrain data. Time, O₂, GO / NO-GO and the point of no return are always labeled as estimates from our model, with the key assumptions in one line (decision record [`docs/decisions/0002-data-nature-and-labels.md`](docs/decisions/0002-data-nature-and-labels.md)).

Example: the demo loop (habitat → five targets → habitat) is 16.61 km, 4.9 h and 0.54 kg of O₂, which is GO.

## Run it

```bash
cd web
npm install
npm run dev
```

Requires Node 20+ (tested with Node 24). The 3D view needs a free Cesium ion token: copy `web/.env.example` to `web/.env.local` and set `VITE_CESIUM_ION_TOKEN`. Never commit the token.

## Scripts (in `web/`)

| Script | What it does |
|---|---|
| `npm run dev` | Vite development server |
| `npm run build` | Type check (`tsc -b`) and production build in `web/dist` |
| `npm run lint` | Lint with oxlint |
| `npm run format` | Format the code with Prettier |
| `npm test` | Tests with Vitest (`src/**/*.test.ts`) |
| `npm run preview` | Serve the production build locally |

## Data sources and assumptions

Every data file, map layer and number in the app has a cited source or is marked as an assumption:

- [`docs/data-sources.md`](docs/data-sources.md): every file in `web/public/data/` and every map layer, with mission, instrument, product, DOI, data date, terms of use and citation.
- [`docs/routing-assumptions.md`](docs/routing-assumptions.md): every number behind the route, the time, the O₂ and the GO / NO-GO verdict, each marked as a published reference or as our assumption. This includes the suit O₂ source, the 10% reserve and the best order method.
- [`docs/terrain-data.md`](docs/terrain-data.md), [`docs/targets.md`](docs/targets.md), [`docs/conditions.md`](docs/conditions.md) and [`docs/alignment-validation.md`](docs/alignment-validation.md): how the terrain grid, the science targets and the MEDA conditions were built and checked.

In short:

- **Map layers:** NASA Mars Trek (MRO HiRISE and CTX, Mars Odyssey THEMIS, MGS MOLA).
- **Terrain grid:** the USGS HiRISE DTM of Jezero (MRO).
- **Conditions:** the Mars 2020 MEDA archive in the PDS. They are the last data available, not a live feed.
- **Science targets:** placed on Perseverance rover waypoints. Two of them credit the orbital mapping by MRO CRISM.
- **Suit O₂:** NASA NTRS 20160002044.

## Data pipeline (in `pipeline/`)

Python scripts turn the NASA source data into the light static files in `web/public/data/`. They run once and the raw data is not versioned. The commands for each file are in "How to reproduce" in [`docs/terrain-data.md`](docs/terrain-data.md).

```bash
python -m venv pipeline/.venv
pipeline/.venv/Scripts/python -m pip install -r pipeline/requirements.txt
pipeline/.venv/Scripts/python -m pytest pipeline/tests
```

## Stack

| Part | Choice |
|---|---|
| App | Vite + React + TypeScript, static single-page app |
| 2D map | Leaflet in EPSG:4326 with NASA Mars Trek tiles |
| 3D view | CesiumJS + Cesium Mars (Cesium ion) |
| Routing | A*, walking model and O₂ budget in TypeScript, in a Web Worker |
| State | Zustand |
| UI | A small UI kit in plain CSS that follows the shadcn/ui conventions: design tokens, a 12–20 px type scale, Button, Badge, Select (`web/src/ui/kit.css`, `kit.tsx`, `icons.tsx`). No Tailwind, no icon library |
| Data | Python (rasterio, numpy), run once, output as static files |
| Tests | Vitest (routing, data contract, state, UI helpers); pytest for the pipeline |

## Structure

```
web/                 # Vite + React + TypeScript app
  src/map/           # Leaflet, layers, Mars CRS
  src/routing/       # cost, A*, walking model, O₂, return paths, best order, Web Worker
  src/three-d/       # CesiumJS 3D view
  src/ui/            # panels, cards and the UI kit (kit.css, kit.tsx, icons.tsx)
  src/state/         # global state (Zustand)
  src/lib/           # utilities (Mars geodesy, data loading)
  src/types/         # data contract types
  public/data/       # pipeline output (static files)
pipeline/            # Python scripts that build the data files, with their tests
docs/                # data sources, assumptions, validation and decision records
```

## Workstreams

| Workstream | Does |
|---|---|
| Tech lead + 2D map | Leaflet, Mars Trek layers, integration |
| Data/GIS | Python: terrain, slope, layers, targets |
| Routing | Cost function, A*, time, O₂, return, best order |
| 3D | CesiumJS with Cesium Mars |
| UI/panels | Conditions, cards, layout, UI kit |
| Product/pitch | Narrative, science content, video, submission, references |

## Deploy and the `main` rule

Deploy runs on Cloudflare Workers (static assets, `web/wrangler.jsonc`) with Workers Builds connected to `main`: root directory `web`, build command `npm run build`, deploy command `npx wrangler deploy`. For the 3D view, `VITE_CESIUM_ION_TOKEN` must be set in the build environment.

**`main` is always deployable:** never break `main`; work on a branch and open a small PR. The full rules are in [`AGENTS.md`](AGENTS.md).

## AI assistance

This project was built with the help of two AI coding assistants: **Claude Code** (Anthropic) and **Codex** (OpenAI). They helped write the code, the tests, the documentation and the data pipeline. The team set the goals, made the decisions and is responsible for the result. Every data source, citation and assumption is recorded in [`docs/data-sources.md`](docs/data-sources.md).

## License

GPL-3.0 (see `LICENSE`).

---

Developed by [Cavalcante](https://github.com/cgonssalves) · [Corrêa](https://github.com/gustavomcss) · [Kourly](https://github.com/pedrokourly) · [Monteiro](https://github.com/MeloLuc) · [Paulo](https://github.com/PauloRicardo-05) · [Vinhal](https://github.com/michaelvinhal)
