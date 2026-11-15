# Decision 0001: Jezero only, map and features

- **Status:** accepted
- **Date:** 2026-11-14
- **Affects:** every workstream (Map 2D, Data/GIS, Routing, 3D, UI, Product)

## Context

Routing, the O₂ budget and the science targets only work inside the Jezero terrain grid (`meta.json` bbox), because that is the only place with a detailed elevation model (HiRISE DTM, see [`docs/terrain-data.md`](../terrain-data.md)). A whole-planet map view was tried on Nov 14 (global CTX + MOLA, opening flight from the planet into the crater) and then reverted: it added a second, unrelated story to a 2-minute demo and made the imagery jump between very different resolutions.

## Decision

1. **The app is 100% about Jezero crater.** The map only shows the Jezero region and every feature (layers, routes, targets, conditions, 3D) targets that region. No whole-planet view, no other sites.
2. **Map view:** limited to the crater plus a margin, `[[17.95, 77.05], [18.9, 78.05]]` (south-west, north-east), zoom 9 to 17, opening at zoom 10 on the area of interest (`web/src/map/MapView.tsx`).
3. **Routes stay inside the area of interest** (`meta.json` bbox); clicks outside it are rejected, as today.
4. **Layer set** to meet the Must "4+ layers from 3+ missions, with provenance":

| Role | Layer | Mission / instrument | Coverage in the app | Resolution | Status |
|---|---|---|---|---|---|
| Optical, EVA detail | HiRISE Jezero ortho mosaic | MRO / HiRISE | ~20 × 20 km around the landing site | 25 cm/px | in the app |
| Optical, crater context | CTX Jezero controlled mosaic | MRO / CTX | ~30 × 30 km | 6 m/px | in the app (default base) |
| Topography | MOLA color shaded relief | MGS / MOLA | whole view | 463 m/px | in the app (translucent tint) |
| Thermal | THEMIS daytime IR | Mars Odyssey / THEMIS | whole view | 100 m/px | in the app (overlay + backdrop) |
| Spectral (mineralogy) | CRISM mineral map of Jezero | MRO / CRISM | Jezero | ~18 m/px | **dropped (2026-11-15)** |

   CTX stays because HiRISE covers only ~20 km and the crater is ~45 km wide; it also matches HiRISE to the pixel (measured, see [`docs/spike/mars-trek.md`](../spike/mars-trek.md)).

## The spectral (or radiation) layer

What exists, checked in the Mars Trek catalog on 2026-11-14:

- **CRISM (MRO), recommended.** CRISM is the instrument that found the carbonates and olivine at Jezero, which is exactly the story of our "Carbonate margin" target. Mars Trek lists CRISM mineral browse mosaics (e.g. `frt_07_brcarj_mtr3_ll`, carbonates; `frt_07_brmafj_mtr3_ll`, olivine/mafic), but they are **footprint datasets, not WMTS tiles** (their tile endpoints return 404). So it must come from the pipeline: take the CRISM MTRDR browse products (CAR or MAF) over Jezero from the PDS Geosciences Node, georeference them on the app grid and export a PNG with its bounds, shown with `L.imageOverlay` (same approach as `slope.png`, issue #26). Provenance label: MRO / CRISM, product ID, acquisition date.
- **TES mineral and thermal-inertia maps (MGS), fallback with no pipeline work.** Available as Mars Trek tiles (`TES_Clinopyroxene`, `TES_Plagioclase`, `TES_Glass_Clay`, `TES_Thermal_Inertia`), but they are kilometers per pixel: Jezero becomes a handful of colored blocks. Use only if CRISM is not ready by the feature freeze.
- **Radiation: no map layer.** There is no radiation map at crater scale. The only surface measurement is Curiosity's RAD, at a single point in Gale crater. Radiation goes in the conditions panel as a reference value with its source (issue #31), not as a layer.

## Consequences per workstream

- **Map 2D:** keep the Jezero-only view; add the CRISM overlay when Data/GIS delivers it (generic `LegendDef` is ready for its color legend). The global CTX layer and the planet view are not coming back.
- **Data/GIS:** produce the CRISM overlay (PNG + bounds + provenance) on the same alignment checks as the other rasters; keep every raster inside the Jezero view above.
- **Routing:** unchanged; the grid is Jezero only.
- **3D:** load only the Jezero region; same route GeoJSON, targets and provenance as the 2D map.
- **UI:** the conditions panel shows radiation as a reference value with its source, never as "live".
- **Product:** the pitch says "best available resolution at each scale, down to 25 cm per pixel in the EVA area", and names the mission behind each layer.

## Out of scope (do not propose)

Whole-planet or multi-site map views, other craters, global rasters as main imagery, and radiation maps.

## Update (2026-11-15): CRISM dropped

The CRISM overlay was built (issue #64) from the MTRDR browse product `FRT00005C5E_07_BRCARJ_MTR3` and then removed: on the map it did not read well over CTX/HiRISE. The 2D map keeps CTX, HiRISE, MOLA, THEMIS and the slope hazard layer (three missions: MRO, MGS and Mars Odyssey, which still meets "4+ layers from 3+ missions"). No spectral layer is planned before the submission; the TES fallback above is not adopted either. The `mro-crism` entry in `missions.json` stays, because target texts cite CRISM as the instrument that found Jezero's carbonates and olivine.
