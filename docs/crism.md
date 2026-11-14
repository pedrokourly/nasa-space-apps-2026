# CRISM mineral overlay: recommended source and recipe

Research for issue #64 (2D-map overlay) and the Data/GIS deliverable `crism.png` + `crism.json` (contract in section 5 of [`AGENTS.md`](../AGENTS.md); layer choice in [decision 0001](decisions/0001-jezero-only.md)). Everything below was **read from the PDS Geosciences Node on 2026-11-14** (directory listings and the product label); the PNG itself was **not downloaded or inspected** yet.

## Recommended product

| Field | Value |
|---|---|
| Mission / instrument | Mars Reconnaissance Orbiter (MRO), NASA / CRISM (Compact Reconnaissance Imaging Spectrometer for Mars) |
| Observation | `FRT00005C5E` (Full Resolution Targeted, hex observation ID `00005C5E`), joined VNIR+IR sensor, MTRDR version 3 |
| Product to use (carbonate) | `FRT00005C5E_07_BRCARJ_MTR3`, the CAR browse product |
| Companion (olivine / mafic) | `FRT00005C5E_07_BRMAFJ_MTR3`, the MAF browse product |
| Acquired | **2007-05-19** (`START_TIME = 2007-05-19T09:30:37.429`, `STOP_TIME = 2007-05-19T09:32:45.163`, orbit 3798) |
| Archive | PDS Geosciences Node, volume `MROCR_4001`, dataset `MRO-M-CRISM-5-RDR-MPTARGETED-V1.0` (MTRDR, Map-projected Targeted RDR) |
| Volume page | https://pds-geosciences.wustl.edu/mro/mro-m-crism-5-rdr-mptargeted-v1/mrocr_4001/ |
| Product folder | https://pds-geosciences.wustl.edu/mro/mro-m-crism-5-rdr-mptargeted-v1/mrocr_4001/browse/2007/2007_139/FRT00005C5E/ |
| CAR PNG | `.../browse/2007/2007_139/FRT00005C5E/frt00005c5e_07_brcarj_mtr3.png` (548,148 bytes; RGB + alpha) |
| CAR label | `.../browse/2007/2007_139/FRT00005C5E/frt00005c5e_07_brcarj_mtr3.lbl` (also `.hdr`, `.img`, `.xml` in the same folder) |
| Generic landing page | https://pds-geosciences.wustl.edu/missions/mro/crism.htm |

What the label (`frt00005c5e_07_brcarj_mtr3.lbl`) says:

- Image size 890 × 891 px, `MAP_SCALE` 0.018 km/px (**18 m/px**), equirectangular projection (center latitude 15°N, center longitude 0°) on a sphere of radius 3394.84 km.
- Extent: `WESTERNMOST_LONGITUDE` 77.279195, `EASTERNMOST_LONGITUDE` 77.558793, `MINIMUM_LATITUDE` 18.364672, `MAXIMUM_LATITUDE` 18.635047 (east longitude 0 to 360, which here is the same as −180 to 180). That box contains the Jezero delta (about 77.43 E, 18.46 N) and the landing site.
- The PNG is a 3-band composite (CAR: red = `D2300`, green = `BD2500_2`, blue = `BD1900_2`) with an **alpha channel that is transparent outside the scene**, which is exactly what `crism.png` needs.
- The PDS description of the CAR browse product: bluish- or yellowish-white colors often indicate carbonate, red/magenta colors may indicate Fe/Mg phyllosilicate, blue colors likely other hydrated minerals; spectra are needed for a positive identification (the label cites Viviano-Beck et al., 2014, for the band definitions).
- MAF band names: `OLINDEX3` (red), `LCPINDEX2` (green), `HCPINDEX2` (blue). Olivine and Fe-phyllosilicate may appear red, low-Ca pyroxene green/cyan, high-Ca pyroxene blue/magenta.

Why this observation: it is one of the three CRISM images over Jezero used by the carbonate/olivine studies, and the USGS PyHAT example for Jezero uses it too (`FRT00005C5E_07_IF166J_MTR3`). Other Jezero observations exist (e.g. `FRT000047A3`, `HRL000040FF`) but were **not** checked in the archive.

**Not confirmed:** that `FRT00005C5E`'s image, once overlaid, lines up with CTX to within a pixel (see "Alignment" below); that the CAR colors read well at our zoom levels; and the Jezero bbox of the other observations. Do not quote more than the table above.

## Recipe for Data/GIS (`crism.png` + `crism.json` on the app grid)

1. **Download** the CAR `.png` and `.lbl` (about 0.5 MB, not the whole volume). Do not commit raw downloads, only the outputs (`AGENTS.md`, section 9).
2. **Read the extent from the label**, not from the PNG: `bbox = [WESTERNMOST_LONGITUDE, MINIMUM_LATITUDE, EASTERNMOST_LONGITUDE, MAXIMUM_LATITUDE]` = `[77.279195, 18.364672, 77.558793, 18.635047]`. Longitude already falls in −180..180; if you ever use a product with longitude above 180, subtract 360 here, in the pipeline (`AGENTS.md`, section 6).
3. **Reproject to plain lon/lat (EPSG:4326)** if you need exactness. The product uses an equirectangular projection with a standard parallel at 15°N, so x is linear in longitude and y is linear in latitude: the image can be stretched over the bbox as it is, and Leaflet's `L.imageOverlay` on `MarsCRS` does exactly that. If you want a clean raster instead, use `gdalwarp` with the sphere from the `.hdr` coordinate system string (radius 3394839.8 m) to `EPSG:4326` on a sphere of 3389500 m, resampling with nearest neighbor (these are class-like colors) and keeping the alpha band.
4. **Keep the alpha channel.** Output `web/public/data/crism.png` as RGBA with alpha 0 wherever the scene has no data. Keep it inside the Jezero view limits (`[[17.95, 77.05], [18.9, 78.05]]`); this scene already is.
5. **Write `web/public/data/crism.json`:**

   ```json
   {
     "bbox": [77.279195, 18.364672, 77.558793, 18.635047],
     "product_id": "FRT00005C5E_07_BRCARJ_MTR3",
     "acquired": "2007-05-19",
     "mineral": "Carbonate",
     "legend": { "title": "CRISM CAR browse product", "entries": [ { "color": "#...", "label": "..." } ] }
   }
   ```

   Do not set `mock`. The CAR PNG is an RGB composite of three spectral parameters, not a classification, so the legend must say that. Two honest options: (a) keep the composite and describe the colors with the PDS wording above (bluish/yellowish-white: carbonate-bearing, likely; red/magenta: Fe/Mg-phyllosilicate, possible; blue: other hydrated minerals), picking swatch colors from the actual PNG; (b) classify the bands yourself into a few categories with documented thresholds (a hypothesis, to mark as such) and draw those colors. Either way keep "needs spectral confirmation" in a legend label or in the docs.
6. **Alignment (acceptance criterion of #64).** Overlay the PNG on CTX/HiRISE (Mars Trek) and check that the delta front and the crater floor edge show no offset; at 18 m/px a one-pixel shift is 18 m. If there is a shift, measure it and correct the bbox (do not shift the image); check pixel-edge versus pixel-center in the label before adjusting. Record the measured offset here.
7. **Cite** the product in this file (done above) and keep `missions.json` entry `mro-crism` (already there) as the mission/instrument source; the app takes product ID and date from `crism.json`.
8. Run the app: with the real files in `web/public/data/`, the layer control must show the real product ID and date with no "MOCK" marker; without them it falls back to `data/mock/` and says so.

## Mock files (until the real ones arrive)

`web/public/data/mock/crism.json` and `crism.png` are made up: striped colored blobs over a small area of the Jezero grid, `product_id: "MOCK"`, `mock: true`. The PNG is generated by `web/scripts/make-mock-crism.mjs`. They carry no scientific information.
