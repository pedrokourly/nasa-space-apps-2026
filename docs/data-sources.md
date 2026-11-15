# Data sources and citations

Every data file in `web/public/data/`, every map layer and every reference behind the app texts, with where it comes from, its date, its terms of use and what we assumed. Issue #33. Update it whenever a new file lands in `web/public/data/`: `pipeline/tests/test_data_sources_doc.py` fails if a file has no row here.

Dates are written as `YYYY-MM-DD`. "Accessed" is the day we read or downloaded the source. Detailed methods are in [terrain-data.md](terrain-data.md), [targets.md](targets.md) and [conditions.md](conditions.md).

## 1. Files in `web/public/data/`

| File | Mission / instrument | Product and URL | DOI | Data date | Terms of use | Citation | Accessed | Assumptions | `missions.json` id |
|---|---|---|---|---|---|---|---|---|---|
| `elevation.bin` | MRO / HiRISE (USGS) | [Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic](https://astrogeology.usgs.gov/search/map/Mars/Mars2020/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40), 1 m, resampled to 512 × 512 | [10.5066/P9REJ9JN](https://doi.org/10.5066/P9REJ9JN) | Images 2006-01-01 to 2019-10-24; published 2020-07-24 | Access: none. Use: "Please cite authors" (USGS product page) | Section 3, HiRISE DTM | 2026-11-14 | A2, A3 | `mro-hirise` |
| `slope.bin` | MRO / HiRISE (USGS) | Computed from `elevation.bin` (same product as above) | [10.5066/P9REJ9JN](https://doi.org/10.5066/P9REJ9JN) | Same as `elevation.bin` | Same as `elevation.bin` | Section 3, HiRISE DTM | 2026-11-14 | **A1**, A2, A3 | `mro-hirise` |
| `meta.json` | MRO / HiRISE (USGS) | Grid geometry (bbox, size, meters per cell), computed from the same DTM | [10.5066/P9REJ9JN](https://doi.org/10.5066/P9REJ9JN) | Same as `elevation.bin` | Same as `elevation.bin` | Section 3, HiRISE DTM | 2026-11-14 | **A2** | `mro-hirise` |
| `targets.geojson` | Mars 2020 (Perseverance) rover records; the `mission` field points to MRO / HiRISE and MRO / CRISM | Names, sols and rock types: NASA [Mars Rock Samples](https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/). Positions: NASA MMGIS [rover waypoints](https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json). Landing site cross-check: [Wikidata Q105824100](https://www.wikidata.org/wiki/Q105824100) and NASA GISS [Mars24](https://www.giss.nasa.gov/tools/mars24/help/landers.html) (the Mars24 page is intermittently unreachable, see section 9). Text facts: Herd et al. (2025) and Brown et al. (2020), see section 4 | Herd 2025: [10.1073/pnas.2404255121](https://doi.org/10.1073/pnas.2404255121); Brown 2020: [10.1029/2019JE006011](https://doi.org/10.1029/2019JE006011) | Rover stops: sol 13 to sol 1084 used (file runs to sol 2022). Samples sealed 2021-09-06 to 2024-03-12 | NASA public web pages and data file, no license text at the source. NASA [media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) apply to NASA content. Credit NASA / JPL-Caltech | Section 3, rover records, and section 4 | 2026-11-14 (waypoints re-checked 2026-11-15); Herd 2025 read 2026-11-15 | **A4**, **A5**, **A6** | `mro-hirise`, `mro-crism`; `mars2020-rover` for the rover records (added 2026-11-15) |
| `conditions.json` | Mars 2020 (Perseverance) / MEDA | PDS bundle `mars2020_meda`, release `mars2020_meda-20260811`; products `DER_PS`, `DER_RHS`, `CAL_ATS`. Data served at the [PDS Atmospheres node](https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/); [bundle page](https://pds.nasa.gov/ds-view/pds/viewBundle.jsp?identifier=urn%3Anasa%3Apds%3Amars2020_meda&version=1.0) | [10.17189/1522849](https://doi.org/10.17189/1522849) | Sols 1857 to 1859, 2026-05-11 to 2026-05-14 UTC (last sols of the release, not live) | Public PDS archive, no restriction at the download site. Cite the bundle (section 3) | Section 3, MEDA | 2026-11-14 | **A7**, **A8**, **A9** | `mars2020-meda` |
| `missions.json` | Not a data source | Legend written by the team from the official mission pages linked in each entry | n/a | n/a | Team content, GPL-3.0 with the repository | n/a | n/a | none | n/a |

## 2. Map layers loaded from NASA Mars Trek

These are not files in `web/public/data/`: the app loads the tiles on demand. Product IDs come from `web/src/map/layers.ts`. All four WMTS capability files answered HTTP 200 on 2026-11-15.

| Layer | Mission / instrument | Product ID (WMTS) | Resolution | Version | DOI | `missions.json` id |
|---|---|---|---|---|---|---|
| CTX Jezero | MRO / CTX | [`JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0`](https://trek.nasa.gov/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/1.0.0/WMTSCapabilities.xml) | 6 m/px | published 2020-07-24 (USGS page) | [10.5066/P9GV1ND3](https://doi.org/10.5066/P9GV1ND3) | `mro-ctx` |
| HiRISE Jezero | MRO / HiRISE | [`JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd`](https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/WMTSCapabilities.xml) | 25 cm/px | published 2020-07-24 (USGS page); the USGS file name ends `_first`, the Mars Trek ID ends `_first_dd` | [10.5066/P9QJDP48](https://doi.org/10.5066/P9QJDP48) | `mro-hirise` |
| MOLA elevation tint | MGS / MOLA | [`Mars_MGS_MOLA_ClrShade_merge_global_463m`](https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/WMTSCapabilities.xml) | 463 m/px | data 1999 to 2001, map processed 2003-03-31; no publication date in the USGS metadata | none in the USGS metadata | `mgs-mola` |
| THEMIS daytime infrared | Mars Odyssey / THEMIS | [`THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018`](https://trek.nasa.gov/tiles/Mars/EQ/THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018/1.0.0/WMTSCapabilities.xml) | 100 m/px | v2, Oct 2018 | none found | `odyssey-themis` |
| Slope hazard | MRO / HiRISE (USGS) | Drawn in the browser from `slope.bin` | ~20 × 12 m/cell | see `slope.bin` | [10.5066/P9REJ9JN](https://doi.org/10.5066/P9REJ9JN) | `mro-hirise` |

The Mars Trek tile files carry no credit, DOI or license: their title is just the product ID. The DOIs above come from the USGS Astropedia pages of the same products, opened in a browser on 2026-11-15:

- **CTX Jezero mosaic:** [Mars 2020 Terrain Relative Navigation Context Camera Orthorectified Image Mosaic](https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_context_camera_orthorectified_image_mosaic). Published 2020-07-24, access none, use "Please cite authors". The USGS file name is the same as the Mars Trek ID.
- **HiRISE Jezero mosaic:** [Mars 2020 Terrain Relative Navigation HiRISE Orthorectified Image Mosaic](https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_hirise_orthorectified_image_mosaic). Published 2020-07-24, access none, use "Please cite authors". The file name differs by a `_dd` suffix, so we **assume** the Mars Trek layer is the same mosaic; we did not confirm it.
- **THEMIS:** the related page [Mars THEMIS Controlled Mosaics and Final Smithed Kernels](https://astrogeology.usgs.gov/search/map/mars-themis-controlled-mosaics-and-final-smithed-kernels) has no DOI, date or use constraint. We did not confirm it is the exact product behind `THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018`. Its references include Christensen et al. (2004), *The Thermal Emission Imaging System (THEMIS) for the Mars 2001 Odyssey mission*, Space Sci. Rev. 110, 85-130, and Fergason, Lee and Weller (2013), *THEMIS Geodetically Controlled Mosaics of Mars*, 44th Lunar and Planetary Science Conference.
- **MOLA:** the FGDC XML metadata of the USGS page [Mars MGS MOLA Global Color Shaded Relief 463m](https://astrogeology.usgs.gov/search/map/mars_mgs_mola_global_color_shaded_relief_463m), downloaded by a teammate on 2026-11-15, describes a 463 m/pixel color shaded relief of the MOLA global elevation model: more than 600 million laser measurements gathered in 1999 to 2001 by MOLA on Mars Global Surveyor, elevations above the areoid, a total elevation uncertainty of at least ±3 m, map processed on 2003-03-31. It lists no publication date and **no DOI**. Access constraint: public domain; use constraint: none. We **assume** it is the product behind the Mars Trek ID `Mars_MGS_MOLA_ClrShade_merge_global_463m` (same resolution and type), but the Mars Trek ID contains `merge` and we did not confirm the match.

Terms of use for the tiles are those of [NASA Mars Trek](https://trek.nasa.gov/mars/); we found no license text on the tile endpoints. The map layers belong to the Mapa 2D workstream; this table only records their sources.

## 3. Citations to copy

**HiRISE DTM** (`elevation.bin`, `slope.bin`, `meta.json`). The USGS asks to cite the authors:

- Fergason, R. L., Hare, T. M., Mayer, D. P., Galuszka, D. M., Redding, B. L., Smith, E. D., Shinaman, J. R., Cheng, Y., Otero, R. E., 2020, *Mars 2020 Terrain Relative Navigation Flight Product Generation: Digital Terrain Model and Orthorectified Image Mosaics*, 51st Lunar and Planetary Science Conference.
- McEwen, A. S. et al., 2007, *Mars Reconnaissance Orbiter's High Resolution Imaging Science Experiment (HiRISE)*, J. Geophys. Res. 112(E5), https://doi.org/10.1029/2005JE002605.
- Fergason, R. L., Galuszka, D. M., Hare, T. M., Mayer, D. P., Redding, B. L., 2020, *Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic*: U.S. Geological Survey, https://doi.org/10.5066/P9REJ9JN (authors as registered with the DOI).

**CTX and HiRISE tile layers.** The USGS asks to cite the authors. Besides Fergason et al. (2020) above, its pages list:

- Malin, M. C. et al., 2007, *Context Camera Investigation on board the Mars Reconnaissance Orbiter*, J. Geophys. Res. 112(E5), https://doi.org/10.1029/2006JE002808 (CTX).
- McEwen et al. (2007), listed above (HiRISE).
- CTX mosaic: https://doi.org/10.5066/P9GV1ND3. HiRISE mosaic: https://doi.org/10.5066/P9QJDP48.

**MOLA tile layer.** The USGS metadata lists, among its references:

- Smith, D. E. et al., 2001, *Mars Orbiter Laser Altimeter: Experiment summary after the first year of global mapping of Mars*, J. Geophys. Res. 106(E10), 23689-23722, https://doi.org/10.1029/2000JE001364 (title, journal and pages checked in Crossref).
- Albee, A. L. et al., 2001, *Overview of the Mars Global Surveyor mission*, J. Geophys. Res. 106(E10), 23291-23316, https://doi.org/10.1029/2000JE001306 (as listed by the USGS; not checked in Crossref).

**MEDA** (`conditions.json`). From the bundle label of the release (`bundle.xml`):

- Rodriguez-Manfredi, J. A., and de la Torre Juarez, M., 2021, *Mars 2020 MEDA Bundle*, NASA Planetary Data System, https://doi.org/10.17189/1522849. The label also lists the instrument paper, https://doi.org/10.1007/s11214-021-00816-9.

**Rover records** (`targets.geojson`). The sources ask for no specific citation. We credit them as:

- NASA / JPL-Caltech, *Mars Rock Samples*, https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/.
- NASA / JPL-Caltech, *Mars 2020 rover waypoints*, MMGIS layer `M20_waypoints.json`.

## 4. Literature behind the target texts

| Reference | Used for | How we read it |
|---|---|---|
| Herd, C. D. K. et al., 2025, *Sampling Mars: Geologic context and preliminary characterization of samples collected by the NASA Mars 2020 Perseverance Rover Mission*, PNAS 122(2), e2404255121, [doi](https://doi.org/10.1073/pnas.2404255121) | Crater floor, Séítah, Máaz, delta front, upper fan and margin unit descriptions | Full text on PubMed Central, 2026-11-15 |
| Brown, A. J. et al., 2020, *Olivine-Carbonate Mineralogy of the Jezero Crater Region*, JGR Planets 125(3), e2019JE006011, [doi](https://doi.org/10.1029/2019JE006011) | CRISM mapped olivine and carbonate in the Jezero region | Abstract and search summary only, 2026-11-15; not read in full |
| Sun, V. Z. et al., 2023, *Overview and Results From the Mars 2020 Perseverance Rover's First Science Campaign on the Jezero Crater Floor*, JGR Planets 128(6), e2022JE007613, [doi](https://doi.org/10.1029/2022JE007613) | Landing site about 2 km from the west delta front (`docs/terrain-data.md`) | Search summary only, 2026-11-14; not read in full |

The sentence-by-sentence mapping of each `why` text to its source is in [targets.md](targets.md).

## 5. Assumptions and decisions without a reference

Marked **A1** to **A9** in the table of section 1.

| ID | What we assumed | Where it is explained |
|---|---|---|
| A1 | The slope comes from the ~20 × 12 m grid, not from the 1 m DTM. It underestimates small steps | [terrain-data.md](terrain-data.md), "slope.bin" |
| A2 | The bbox `[77.32, 18.40, 77.50, 18.50]` is our choice, not a data limit. The DTM covers about 21 × 21.5 km | [terrain-data.md](terrain-data.md), "App grid" |
| A3 | The vertical datum of the altitudes is not stated by the USGS. The name suggests a MOLA reference, and the DTM agrees with the rover's `elev_geoid` (median 0.00 m), but that is our inference | [terrain-data.md](terrain-data.md), "Caveats" |
| A4 | A target position is the rover's last stop before the sample, not the exact coring spot | [targets.md](targets.md), "Limits" |
| A5 | `mission` is the MRO instrument that shows or mapped the feature, not a verified discovery credit | [targets.md](targets.md), "Missions" |
| A6 | The `why` texts are sourced, but the wording is ours and no planetary scientist reviewed it | [targets.md](targets.md), "Limits" |
| A7 | Air temperature is the mean of the five air sensors in each record | [conditions.md](conditions.md), "Assumptions" |
| A8 | Humidity is in percent; the PDS label gives no unit | [conditions.md](conditions.md), "Assumptions" |
| A9 | Min, mean and max cover all valid records of the sol, with no day and night split. Sol dates are the label coverage of the products | [conditions.md](conditions.md), "Assumptions" |

Not ours but also assumptions: the walking speed, the O₂ model and the slope limit of the route, in [routing-assumptions.md](routing-assumptions.md); the 3D slope colors and sun direction, in [3d-view.md](3d-view.md).

## 6. Sources not used (yet)

| Source | Status |
|---|---|
| IAU / USGS Gazetteer of Planetary Nomenclature | Not used. Feature names come from the NASA sample table |
| USGS SIM 3464 geologic map | Not used (issue #19 is open) |
| Curiosity RAD radiation | Not used (issue #31 is open) |
| THEMIS thermal inertia on the grid | Not used (issue #29 is open); only the Mars Trek tile is shown |
| Full Perseverance traverse as GeoJSON | Not exported (issue #27 is open); the waypoints are used only to place and check targets |
| CRISM mineral overlay | Dropped by the team (issue #64) |
| MEDA wind and dust | No usable product for sols 1857 to 1859; written as unavailable |

## 7. Entries for `missions.json`

Every source above has an entry in `web/public/data/missions.json`. The entry `mars2020-rover` (Perseverance rover traverse and sample records, the source of `targets.geojson`) was added on 2026-11-15 together with this document.

## 8. Other software and 3D data (other workstreams)

| Item | Use | License or attribution |
|---|---|---|
| Cesium Mars 3D Tiles (Cesium ion asset `3644333`) | 3D relief | Attribution reported by Cesium ion: NASA, ESA and the USGS Astrogeology Science Center ([3d-view.md](3d-view.md)) |
| CesiumJS 1.147.0 | 3D view | Apache-2.0 ([3d-view.md](3d-view.md)) |
| Leaflet 1.9.4 | 2D map | BSD-2-Clause (read from `package.json` in `node_modules`) |
| React and React DOM 19.3.1 | Interface | MIT (read from `package.json` in `node_modules`) |
| Zustand 5.1.0 | State | MIT (read from `package.json` in `node_modules`) |
| Python: numpy, rasterio, pytest | Data pipeline | Versions pinned in `pipeline/requirements.txt` |

## 9. Link check

On 2026-11-15 we extracted the 22 URLs and DOIs of the first version of this file and opened each with an HTTP request. The USGS pages and DOIs added later (CTX, HiRISE mosaic, THEMIS) were opened in a browser instead:

- **18 answer HTTP 200.** The USGS product page of the HiRISE DTM also answers 200, but only to a request with a browser user agent: without one the USGS host answers 403.
- **The Mars24 page** answered 200 during the check but did not open for a teammate later the same day, and a second request from our side failed too. We treat it as intermittent. The landing site is also confirmed by Wikidata and by the first rover waypoint (sol 13).
- **The MOLA metadata** was read from the FGDC XML file that a teammate downloaded from the USGS page; the "no DOI" finding comes from that file.
- **4 journal DOIs answer HTTP 403 to automated requests** (Herd 2025, Brown 2020, Sun 2023 and McEwen 2007). The publishers block scripts. For each we checked that doi.org redirects to the expected publisher page (PNAS or Wiley).

The titles, authors, journals and years of the seven DOIs with a bibliographic record (the four articles, the MEDA instrument paper, the USGS DTM and the MEDA bundle) were compared with the Crossref and DataCite records on 2026-11-15, and they match the citations above. **Checked by a person.** After these automated checks, the owner of the Data/GIS workstream opened the links by hand in a browser on 2026-11-15 and reported that they opened the expected pages: the product pages of USGS and NASA, the six journal and bundle DOIs, the PDS and MMGIS data endpoints, Wikidata and the NASA media guidelines. The Mars24 page stays the only unstable link. This is a check by someone other than the author of the file, as issue #33 asks; a second teammate repeating it would still help.
