# Martian Map · Jezero

Our entry for the NASA Space Apps 2026 challenge "Interplanetary Survival Guide: Martian Map".

A Marswalk planner for Jezero crater: a layered 2D map built from several NASA missions, a safe route computed over real terrain, an O₂ budget with a GO / NO-GO verdict, and an optional 3D view. The app is fully static, with no backend.

**Live demo:** https://martian-map.pedrokourly.dev

## Run it

```bash
cd web
npm install
npm run dev
```

Requires Node 20+ (tested with Node 24).

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
- [`docs/routing-assumptions.md`](docs/routing-assumptions.md): every number behind the route, the time, the O₂ and the GO / NO-GO verdict, each marked as a published reference or as our assumption.
- [`docs/terrain-data.md`](docs/terrain-data.md), [`docs/targets.md`](docs/targets.md), [`docs/conditions.md`](docs/conditions.md) and [`docs/alignment-validation.md`](docs/alignment-validation.md): how the terrain grid, the science targets and the MEDA conditions were built and checked.

In short: the map layers come from NASA Mars Trek (MRO HiRISE and CTX, Mars Odyssey THEMIS, MGS MOLA); the terrain grid comes from the USGS HiRISE DTM of Jezero (MRO); the conditions come from the Mars 2020 MEDA archive in the PDS and are the last data available, not a live feed; the science targets are placed on Perseverance rover waypoints, and two of them credit the orbital mapping by MRO CRISM.

## Data pipeline (in `pipeline/`)

Python scripts turn the NASA source data into the light static files in `web/public/data/`. They run once and the raw data is not versioned. The commands for each file are in "How to reproduce" in [`docs/terrain-data.md`](docs/terrain-data.md).

```bash
python -m venv pipeline/.venv
pipeline/.venv/Scripts/python -m pip install -r pipeline/requirements.txt
pipeline/.venv/Scripts/python -m pytest pipeline/tests
```

## Structure

```
web/                 # Vite + React + TypeScript app
  src/map/           # Leaflet, layers, Mars CRS
  src/routing/       # cost, A*, walking model, O₂, return paths, Web Worker
  src/three-d/       # CesiumJS 3D view
  src/ui/            # panels and cards
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
| Routing | Cost function, A*, time, O₂, return |
| 3D | CesiumJS with Cesium Mars |
| UI/panels | Conditions, cards, layout |
| Product/pitch | Narrative, science content, video, submission, references |

## Deploy and the `main` rule

Deploy runs on Cloudflare Workers (static assets, `web/wrangler.jsonc`) with Workers Builds connected to `main`: root directory `web`, build command `npm run build`, deploy command `npx wrangler deploy`.

**`main` is always deployable:** never break `main`; work on a branch and open a small PR. The full rules are in [`AGENTS.md`](AGENTS.md).

## License

GPL-3.0 (see `LICENSE`).
