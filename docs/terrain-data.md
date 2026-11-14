# Jezero terrain data: 1 m HiRISE DTM

Result of the issue #22 spike, extended by #23 (grid), #24 (elevation) and #25 (slope). Every number in "What the file says" was **read from the GeoTIFF** with `pipeline/inspect_dtm.py` (rasterio 1.5.2, GDAL 3.12.2), not assumed.

## Decision

We use the **1 m HiRISE DTM (Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic)** as the Jezero terrain source: its resolution is far above the ~20 m app grid, it covers the Perseverance landing site and it already uses longitude −180 to 180.

## What this file is and is not

- **It is** a 1 m DTM (altitude map) made by the USGS from **stereo pairs of HiRISE camera images** (6 pairs, 7 DTMs; see "Completeness Report" on the product page). That is why the mission is MRO and the instrument is HiRISE.
- **It is not** an image: it has a single band of altitude in meters. It holds no optical, thermal or spectral data.
- **It is not MOLA data.** The "MOLA" in the name (`MOLAtopography_DeltaGeoid`) seems to describe the vertical reference of the altitudes (an inference, see Caveats). Global MOLA has hundreds of meters per pixel; this file has 1 m.
- **The HiRISE optical layer of the map** (the picture the astronaut sees) comes from **Mars Trek tiles**, loaded on demand in Leaflet, not from this file. This `.tif` only feeds the pipeline (`elevation.bin`, `slope.bin`) and the routing.

## Provenance

| Field | Value |
|---|---|
| Mission | Mars Reconnaissance Orbiter (MRO), NASA |
| Instrument | HiRISE (High Resolution Imaging Science Experiment) |
| Product | Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic |
| File | `JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif` (1,839,545,409 bytes, ~1.8 GB) |
| Publisher | USGS Astrogeology Science Center |
| Publication date | 2020-07-24 |
| Image period | 2006-01-01 to 2019-10-24 |
| DOI | [10.5066/P9REJ9JN](https://doi.org/10.5066/P9REJ9JN) |
| Product page | https://astrogeology.usgs.gov/search/map/Mars/Mars2020/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40 |
| Download | https://planetarymaps.usgs.gov/mosaic/mars2020_trn/HiRISE/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif (redirects to the USGS S3 bucket) |
| Metadata | FGDC XML and PDS3 Label on the product page |
| Constraints | Access: none. Use: "Please cite authors" |

### Citation

- Fergason, R. L., Hare, T. M., Mayer, D. P., Galuszka, D. M., Redding, B. L., Smith, E. D., Shinaman, J. R., Cheng, Y., Otero, R. E., 2020, *Mars 2020 Terrain Relative Navigation Flight Product Generation: Digital Terrain Model and Orthorectified Image Mosaics*, 51st Lunar and Planetary Science Conference.
- McEwen, A. S. et al., 2007, *Mars Reconnaissance Orbiter's High Resolution Imaging Science Experiment (HiRISE)*, J. Geophys. Res. 112, E05S04, https://doi.org/10.1029/2005JE002605.
- USGS Astrogeology Science Center, 2020, Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic, https://doi.org/10.5066/P9REJ9JN.

## What the file says

| Item | Value |
|---|---|
| Format | GeoTIFF, 1 band, `float32`, striped (one row per strip, 85,600 bytes), no overviews |
| Size | 21,400 columns × 21,488 rows |
| Value unit | meters (altitude) |
| nodata | `-3.4028226550889045e+38` (lowest float32) |
| CRS | Equirectangular Mars 2000 Sphere IAU (`+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=0 +R=3396190`) |
| Body radius | **3,396,190 m** (sphere). The app uses 3,389.5 km in `src/lib/mars-geo.ts` |
| Latitude | planetocentric |
| Longitude convention | **−180 to 180, positive east** (confirmed in the PDS3 Label). Jezero is at ~77°E, so 0–360 and −180–180 coincide |
| Raster origin | row 0 = north (transform `1, 0, 4577366 / 0, -1, 1106618`) |
| bbox in the CRS (m) | x 4,577,366 to 4,598,766; y 1,085,130 to 1,106,618 |
| bbox lon/lat | lon 77.2229° to 77.5840°E; lat 18.3068° to 18.6693°N |
| Extent | 21.40 km (x) × 21.49 km (y) |
| Pixel in the CRS | 1 m × 1 m |

### Real meters per pixel

In the Equirectangular projection with standard parallel 0, a pixel measures 1 m in y but shrinks in x with the cosine of the latitude:

| Latitude | x (ground m/pixel) | y (ground m/pixel) |
|---|---|---|
| 18.3068°N (south edge) | 0.9494 | 1.0000 |
| 18.4881°N (center) | 0.9484 | 1.0000 |
| 18.6693°N (north edge) | 0.9474 | 1.0000 |

The values differ (x ≈ 0.948 m, y = 1.000 m, ~5% apart). The slope gradient must use these real meters, not 1 m on both axes, or the inclination comes out wrong.

### Coverage and nodata

Full scan of the file (459,843,200 pixels):

- **Valid:** 303,990,958 (66.1%).
- **nodata:** 155,852,242 (**33.9%**). The mosaic footprint is not a rectangle, so there are holes at the edges.
- **Valid elevation:** from −2,665.37 m to −1,639.89 m.
- **Valid pixels span** rows 4 to 21,477 and columns 320 to 21,370.

Routing must treat nodata as **impassable**, never as zero.

## App grid (issue #23)

Geometry fixed in `pipeline/jezero_grid.py` and written to `web/public/data/meta.json` (same format as the mock in `web/public/data/mock/meta.json`, which the app already uses).

| Item | Value |
|---|---|
| bbox `[minLon, minLat, maxLon, maxLat]` | `[77.36, 18.40, 77.50, 18.50]` |
| bbox size (haversine, R = 3389.5 km) | 7.86 km (x) × 5.92 km (y), inside the 5 to 15 km range |
| Inside the DTM coverage | Yes (lon 77.2229 to 77.5840; lat 18.3068 to 18.6693) |
| DTM nodata inside the bbox | 0.00% (decimated read) |
| Elevation in the bbox | −2,647 m to −2,392 m (decimated sample) |
| Grid | 512 × 512 cells |
| Meters per cell | x = 15.345 m, y = 11.554 m (R = 3389.5 km) |
| CRS | EPSG:4326 (lon/lat), row 0 = north |
| nodata written in the `.bin` files | `-3.4028234663852886e+38` (lowest float32, same as the mock) |
| Longitude | −180 to 180, positive east |

### bbox validation against the real Perseverance traverse

Compared with the 708 rover stops published by NASA MMGIS (`https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json`, read in memory, not versioned; fields `sol`, `lon`, `lat`, `elev_geoid`).

- **Landing site:** the first waypoint (sol 13) is at 77.4509°E, 18.4446°N, the same point as the mock habitat, inside the bbox. The coordinates agree with Wikidata and NASA GISS Mars24 (Octavia E. Butler Landing).
- **Traverse coverage:** 313 of the 708 stops fall inside the bbox, all from sols 13 to 886 (crater floor and the delta front campaign). From sol ~896 the rover climbs west (lon < 77.36) and, from sol 1815 on, leaves even the DTM coverage (lon < 77.2229). **The bbox covers only the first part of the traverse, not all of it.**
- **Delta:** a JGR paper (Sun et al., 2023, doi:10.1029/2022JE007613) places the landing site ~2 km from the west delta front, around 77.41°E, inside the bbox. The real targets were fixed in #28 (see `docs/targets.md`).
- **DTM altitude against the rover's** (612 stops with valid data): DTM − rover difference with median 0.00 m, mean 0.57 m, standard deviation 1.41 m, 5th and 95th percentiles of −0.09 and 4.11 m, maximum 5.37 m. This indicates the DTM uses the same vertical reference as the rover and that the horizontal registration is good. It is not a USGS statement, it is our own measurement.

**Why we kept the mock bbox.** It lies entirely over valid DTM data and already contains the mock target and route points (habitat at 77.4508°E 18.4447°N, delta front, carbonate margin). Changing the bbox would force changes in every mock with no gain. The real `meta.json` ended up equal to the mock except for the `source` field.

**Why a lon/lat grid (EPSG:4326) and not a local metric grid.**
- Mars Trek and the app's Leaflet use EPSG:4326: the route, the targets and the overlays (such as `slope.png`) share one system, with no reprojection in the browser.
- The contract and `web/src/types/contract.ts` already fix `crs: "EPSG:4326"`; changing it would require changes in every workstream.
- The source DTM is already a lon/lat grid (Equirectangular with standard parallel 0): each pixel spans the same angle in x and y. Resampling to the app grid is a block average, with no distortion.
- The cost is that the cell is not square in meters (15.3 × 11.6 m). `m_per_cell_x` and `m_per_cell_y` describe that; routing and the slope (#25) must use both values, never just one.

**Resampling note (#24).** The DTM's 1 m pixels are x ≈ 0.948 m on the ground and y = 1.000 m; the bbox spans ~8,300 × 5,917 DTM pixels. The reduction to 512 × 512 must use averaging (`Resampling.average`), and the DTM nodata (`-3.4028226550889045e+38`) must be converted to the contract nodata.

**Radius.** The meters per cell use the app radius (3389.5 km). With the DTM radius (3396.19 km) they would be ~0.2% larger; the difference does not matter for the route, but the two radii must not be mixed in one calculation.

## elevation.bin (issue #24)

Built by `pipeline/export_elevation.py` from the 1 m DTM, in `web/public/data/elevation.bin`.

| Item | Value |
|---|---|
| Format | Float32 little-endian, row-major, row 0 = north, 512 × 512 |
| Size | 1,048,576 bytes (512 × 512 × 4) |
| Valid cells | 262,144 of 262,144 (no nodata inside the bbox) |
| Elevation | min −2,646.73 m, max −2,392.54 m, mean −2,537.21 m |
| Reproducible | Two runs produce identical bytes |
| Reading | `numpy.fromfile(..., dtype="<f4").reshape(512, 512)` |
| Provenance | MRO, HiRISE, USGS Astrogeology, DOI 10.5066/P9REJ9JN (`source` field of `meta.json`) |

**How it was made.** The script reads only the DTM window covering the bbox (about 8,300 × 5,900 pixels, not the whole 21,400 × 21,488 file) and resamples by **block average** (`Resampling.average`) to the 512 × 512 grid. There is no reprojection: the DTM is already a lon/lat grid (`x = R·lon`, `y = R·lat`, R = 3,396,190 m), with longitude −180 to 180.

**nodata rule.** The DTM nodata (`-3.4028226550889045e+38`) becomes the contract one (`-3.4028234663852886e+38`, lowest float32). A grid cell is nodata if **any** 1 m pixel inside it was nodata, and it never becomes 0. This does not happen today, but it applies to a future bbox.

**Validation.** With the 313 rover stops inside the bbox (MMGIS/NASA, `elev_geoid`):

| Comparison | Median | Std. dev. | Max \|diff\| |
|---|---|---|---|
| 1 m DTM − rover altitude | 0.00 m | 0.06 m | 0.43 m |
| `elevation.bin` − 1 m DTM (same point) | 0.02 m | 0.37 m | 2.14 m |
| `elevation.bin` − rover altitude | 0.03 m | 0.37 m | 2.17 m |

The grid difference comes from averaging over 15 × 12 m cells on sloped terrain, not from a shift. For the horizontal alignment, we overlaid a hillshade of `elevation.bin` (azimuth 315°, altitude 45°) on the Mars Trek 25 cm HiRISE tiles at 50% opacity: the features (crater rims, the delta scarp, small mounds) look sharp, with no doubled edges, and the delta scarp continues unbroken across the bbox edge. A one-cell shift (~12 px at the zoom used) would be visible. The visual check was an inspection on a test page outside the repository; the systematic validation against Mars Trek remains #32.

## slope.bin (issue #25)

Built by `pipeline/export_slope.py` from `elevation.bin` and `meta.json`, in `web/public/data/slope.bin`.

| Item | Value |
|---|---|
| Format | Float32 little-endian, row-major, row 0 = north, 512 × 512, in **degrees** |
| Size | 1,048,576 bytes, the same grid as `elevation.bin` |
| Valid cells | 260,100 of 262,144; nodata: 2,044 (the 1-cell grid border) |
| Slope | min 0.00°, max 43.75°, mean 3.59°, median 2.28° |
| Cells above 10° / 15° / 25° | 6.74% / 2.94% / 0.46% |
| Provenance | MRO, HiRISE, USGS Astrogeology, DOI 10.5066/P9REJ9JN (same as `elevation.bin`) |

**Method.** Horn slope (the same as `gdaldem slope`): `dz/dx` and `dz/dy` from a weighted 3 × 3 kernel, using the real meters per cell from `meta.json` (x = 15.345 m, y = 11.554 m), and `slope = degrees(arctan(hypot(dz/dx, dz/dy)))`. Using the same cell size on both axes would give a wrong answer, and an automated test covers that (a 10° ramp in y with different cell sizes returns 10° within 0.1°).

**nodata rule.** A cell has a value only if all 9 kernel cells are valid. A nodata cell contaminates its 8 neighbours, and the **1-cell grid border is nodata** (no neighbours), never 0. Today `elevation.bin` has no holes, so only the border is nodata.

**Assumption: slope scale.** The slope comes from the **512 × 512 grid (~15 × 12 m)**, not from the 1 m DTM. Reason: it is the scale of the routing (A* moves cell by cell) and it keeps `slope.bin` consistent with `elevation.bin`. It is an assumption, not a physical truth. Comparison on the same 262,144 cells (`pipeline/slope_scale_check.py`):

| Scale | Mean | > 15° | > 25° | Correlation with the grid |
|---|---|---|---|---|
| A) ~15 m grid (`slope.bin`) | 3.59° | 2.94% | 0.46% | n/a |
| B) 1 m DTM, mean per cell | 4.85° | 3.62% | 0.58% | 0.93 |
| C) 1 m DTM, max per cell | 9.60° | 14.72% | 3.47% | 0.76 |

Scale A tends to **underestimate** steps and rocks a few meters wide; the 1 m DTM has pixels up to 74.9° and 0.78% above 25°. Scale C is much more conservative (34% of cells above 10°) and could feed a "safer" routing mode, but it would need another file. The impassable slope limit remains a Routing decision.

**Sanity check with real data.** At the 310 Perseverance stops inside the bbox with a valid slope, the slope averages 3.92°, with a maximum of 16.97° and none above 25°. This is consistent with a rover that avoids steep terrain, but it is not strong validation: the whole grid is also smooth (mean 3.59°).

## Caveats

- **Vertical datum not stated.** Neither the PDS3 Label nor the FGDC XML says which surface the altitudes refer to, only "meters". The product name (`MOLAtopography_DeltaGeoid`) suggests a MOLA/Mars geoid reference, but that is an **inference from the name**. There is, however, empirical evidence that the DTM agrees with the `elev_geoid` altitude published by Perseverance (see "bbox validation" above). Slope and route only depend on altitude differences, so this does not block the routing.
- **Low-quality west strip.** The USGS warns that the "Jezero_CR" stereo pair (crater rim, far west) has y-parallax problems and should be used with caution. It lies outside the landing ellipse.
- **Limited coverage.** The mosaic covers ~21 × 21.5 km, not the whole crater. The demo targets and route must fall inside it (checked in #23 and #28).
- **Accuracy.** Horizontal registration between images is better than 3 m at the 99th percentile; the USGS reports a median vertical offset of ~0.4 m against the CTX DTM.
- **Different radius from the app.** Converting lon/lat to meters in the raster uses 3,396,190 m; app distances stay at 3,389.5 km. Do not mix the two in one calculation.

## Alternatives considered

- **MSR 2024 DTM** (DOI [10.5066/P13CPYYU](https://doi.org/10.5066/P13CPYYU), data release of 2025-02-05, ~5.3 GB according to the issue): **not evaluated**, because this product already meets the need.
- **20 m CTX DEM** (`jez_ctx_b_soc_008_dtm_molatopography_deltageoid_20m_eqc_latts0_lon0`, listed as a related product on the USGS page): **not inspected**. It is plan B if the 21 km HiRISE footprint is too small for the route.

## How to reproduce

```bash
python -m venv pipeline/.venv
pipeline/.venv/Scripts/python -m pip install -r pipeline/requirements.txt
curl -L -C - -o data/raw/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif "https://planetarymaps.usgs.gov/mosaic/mars2020_trn/HiRISE/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif"
pipeline/.venv/Scripts/python pipeline/inspect_dtm.py
pipeline/.venv/Scripts/python pipeline/jezero_grid.py        # meta.json (#23)
pipeline/.venv/Scripts/python pipeline/export_elevation.py   # elevation.bin + meta.json (#24)
pipeline/.venv/Scripts/python pipeline/export_slope.py       # slope.bin (#25)
pipeline/.venv/Scripts/python pipeline/slope_scale_check.py  # compares slope scales (optional)
pipeline/.venv/Scripts/python pipeline/export_targets.py     # targets.geojson (#28)
pipeline/.venv/Scripts/python -m pytest pipeline/tests
```

`data/raw/` and `*.tif` are in `.gitignore`: the raw data is not versioned.
