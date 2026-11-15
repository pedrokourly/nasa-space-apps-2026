"""Measure the horizontal alignment of our terrain files against the Mars Trek HiRISE tiles (issue #32).

For each feature (a crater, a mound, the delta scarp) it cuts a ~580 m square around the feature
and compares three views of the same ground:

  image  the Mars Trek HiRISE tile layer the app shows (zoom 15, about 1.2 m/pixel);
  dtm    the 1 m HiRISE DTM, sampled on the image pixels;
  grid   our 512 x 512 `elevation.bin`, sampled on the image pixels.

Brightness in the image is not elevation, so we do not compare the values. We compare where the
edges are: the gradient magnitude of the image against the slope of the terrain, both smoothed to
about 10 m, with a normalized cross-correlation. The peak gives the shift in pixels, converted to
meters. Three pairs are reported:

  dtm vs image   how well the USGS DTM and the Mars Trek tiles agree;
  grid vs image  what the app actually shows (this is the number checked against one grid cell);
  grid vs dtm    what our resampling to 512 x 512 adds.

Shift sign: east and north are positive. "dtm vs image" east = +5 m means the DTM feature sits 5 m
east of the same feature in the image.

The tiles are fetched once into data/raw/mars-trek-tiles/ (ignored by git).

Usage (from the repository root):
    pipeline/.venv/Scripts/python pipeline/validate_alignment.py [--images docs/img]
"""

from __future__ import annotations

import json
import math
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image

from export_elevation import DEFAULT_DTM
from jezero_grid import BBOX, DTM_RADIUS_M, HEIGHT, MARS_RADIUS_APP_M, WIDTH

TILE_URL = (
    "https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/"
    "1.0.0/default/default028mm/{z}/{y}/{x}.png"
)
CACHE = Path("data/raw/mars-trek-tiles")
ELEVATION = Path("web/public/data/elevation.bin")

ZOOM = 15
PX_DEG = 180 / 2**ZOOM / 256  # degrees per pixel, same in lon and lat in this EPSG:4326 tile grid
N = 480  # patch size in pixels (about 580 m)
MAX_SHIFT_PX = 40

# name, lon, lat. Centers were chosen on strong relief and checked on the figures.
FEATURES = [
    ("delta scarp", 77.4040, 18.4620),
    ("rocky terrain with a dune-filled hollow, southwest of the landing site", 77.4259, 18.4315),
    ("pitted terrain with small hollows, east of the landing site", 77.4580, 18.4440),
]


def meters_per_px(lat: float) -> tuple[float, float]:
    """Ground meters per pixel in x (east) and y (north) at the given latitude, with the app radius."""
    m = math.radians(PX_DEG) * MARS_RADIUS_APP_M
    return m * math.cos(math.radians(lat)), m


def fetch_tile(x: int, y: int) -> np.ndarray:
    f = CACHE / f"{ZOOM}_{y}_{x}.png"
    if not f.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(
            TILE_URL.format(z=ZOOM, x=x, y=y),
            headers={"User-Agent": "martian-map-alignment-check (NASA Space Apps 2026 team)"},
        )
        f.write_bytes(urllib.request.urlopen(req, timeout=60).read())
        time.sleep(0.2)
    return np.asarray(Image.open(f).convert("L"), dtype=np.float32)


def hirise_patch(lon: float, lat: float) -> tuple[np.ndarray, float, float]:
    """N x N gray crop of the HiRISE tiles centered on lon/lat, with its top-left corner (lon, lat)."""
    n_tiles = 2**ZOOM
    cx, cy = n_tiles * (lon / 180 + 1), n_tiles * (0.5 - lat / 180)  # fractional tile coordinates
    half = N / 2 / 256 + 0.1
    x0, x1 = int(math.floor(cx - half)), int(math.floor(cx + half))
    y0, y1 = int(math.floor(cy - half)), int(math.floor(cy + half))
    img = np.vstack([np.hstack([fetch_tile(x, y) for x in range(x0, x1 + 1)]) for y in range(y0, y1 + 1)])
    start_col = int(round((cx - x0) * 256 - N / 2))
    start_row = int(round((cy - y0) * 256 - N / 2))
    crop = img[start_row : start_row + N, start_col : start_col + N]
    lon_left = 180 * (x0 / n_tiles - 1) + start_col * PX_DEG
    lat_top = 90 - 180 * y0 / n_tiles - start_row * PX_DEG
    return crop, lon_left, lat_top


def pixel_lonlat(lon_left: float, lat_top: float) -> tuple[np.ndarray, np.ndarray]:
    cols, rows = np.meshgrid(np.arange(N), np.arange(N))
    return lon_left + (cols + 0.5) * PX_DEG, lat_top - (rows + 0.5) * PX_DEG


def bilinear(a: np.ndarray, rr: np.ndarray, cc: np.ndarray) -> np.ndarray:
    rr = np.clip(rr, 0, a.shape[0] - 1.000001)
    cc = np.clip(cc, 0, a.shape[1] - 1.000001)
    r0, c0 = np.floor(rr).astype(int), np.floor(cc).astype(int)
    fr, fc = rr - r0, cc - c0
    return (a[r0, c0] * (1 - fr) * (1 - fc) + a[r0, c0 + 1] * (1 - fr) * fc
            + a[r0 + 1, c0] * fr * (1 - fc) + a[r0 + 1, c0 + 1] * fr * fc)


def sample_dtm(lon: np.ndarray, lat: np.ndarray) -> np.ndarray:
    """1 m DTM bilinearly sampled at lon/lat (the DTM is Equirectangular: x = R*lon, y = R*lat)."""
    x, y = DTM_RADIUS_M * np.radians(lon), DTM_RADIUS_M * np.radians(lat)
    with rasterio.open(DEFAULT_DTM) as ds:
        col = x - ds.bounds.left - 0.5
        row = ds.bounds.top - y - 0.5
        c0, c1 = int(col.min()) - 2, int(col.max()) + 3
        r0, r1 = int(row.min()) - 2, int(row.max()) + 3
        win = rasterio.windows.Window(c0, r0, c1 - c0, r1 - r0)
        z = ds.read(1, window=win, masked=True).astype(np.float64).filled(np.nan)
    return bilinear(z, row - r0, col - c0)


def sample_grid(lon: np.ndarray, lat: np.ndarray) -> np.ndarray:
    """Our elevation.bin bilinearly sampled at lon/lat. Cell centers sit half a cell inside the bbox."""
    min_lon, min_lat, max_lon, max_lat = BBOX
    z = np.fromfile(ELEVATION, dtype="<f4").reshape(HEIGHT, WIDTH).astype(np.float64)
    col = (lon - min_lon) / ((max_lon - min_lon) / WIDTH) - 0.5
    row = (max_lat - lat) / ((max_lat - min_lat) / HEIGHT) - 0.5
    return bilinear(z, row, col)


def gaussian(a: np.ndarray, sigma_px: float) -> np.ndarray:
    r = int(3 * sigma_px)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma_px) ** 2)
    k /= k.sum()
    p = np.pad(a, r, mode="reflect")
    p = np.apply_along_axis(lambda v: np.convolve(v, k, mode="valid"), 0, p)
    return np.apply_along_axis(lambda v: np.convolve(v, k, mode="valid"), 1, p)


def hillshade(elev: np.ndarray, dx_m: float, dy_m: float, azimuth: float, elevation: float) -> np.ndarray:
    """Lambertian shading of the terrain; azimuth clockwise from north, both in degrees."""
    gy_rows, gx = np.gradient(elev)
    p, q = gx / dx_m, -gy_rows / dy_m  # slope toward east and toward north
    az, el = math.radians(azimuth), math.radians(elevation)
    sun = (math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el))
    return (-p * sun[0] - q * sun[1] + sun[2]) / np.sqrt(1 + p**2 + q**2)


BANDS_M = ((2, 20), (4, 40), (8, 80))  # (fine, coarse) scales of the band-pass, in meters; the first is the headline


def band(a: np.ndarray, dy_m: float, fine_m: float, coarse_m: float) -> np.ndarray:
    """Remove the slow brightness (albedo) and keep the shading detail between `fine_m` and `coarse_m`."""
    return gaussian(a, fine_m / dy_m) - gaussian(a, coarse_m / dy_m)


def best_illumination(terrain: np.ndarray, image_band: np.ndarray, dx_m: float, dy_m: float, fine_m: float, coarse_m: float) -> tuple[float, float, float]:
    """Sun azimuth and elevation whose shading best matches the image, and that correlation."""
    inner = slice(60, N - 60)
    best = (0.0, 0.0, -1.0)
    for az in range(0, 360, 15):
        for el in (15, 25, 35, 45, 60):
            h = band(hillshade(terrain, dx_m, dy_m, az, el), dy_m, fine_m, coarse_m)
            r = np.corrcoef(h[inner, inner].ravel(), image_band[inner, inner].ravel())[0, 1]
            if r > best[2]:
                best = (float(az), float(el), float(r))
    return best


def shift_between(a: np.ndarray, b: np.ndarray) -> tuple[float, float, float]:
    """Shift (d_col, d_row, peak) of a relative to b: a(x) = b(x - d). Rows grow to the south."""
    w = np.outer(np.hanning(N), np.hanning(N))
    a, b = (a - a.mean()) * w, (b - b.mean()) * w
    c = np.fft.fftshift(np.fft.irfft2(np.fft.rfft2(a) * np.conj(np.fft.rfft2(b)), s=a.shape))
    c /= math.sqrt((a**2).sum() * (b**2).sum())
    mask = np.zeros_like(c, dtype=bool)
    mask[N // 2 - MAX_SHIFT_PX : N // 2 + MAX_SHIFT_PX + 1, N // 2 - MAX_SHIFT_PX : N // 2 + MAX_SHIFT_PX + 1] = True
    r, col = np.unravel_index(np.argmax(np.where(mask, c, -np.inf)), c.shape)

    def refine(m1: float, m0: float, p1: float) -> float:  # parabola through the peak and its neighbors
        d = m1 - 2 * m0 + p1
        return 0.0 if d == 0 else 0.5 * (m1 - p1) / d

    dr = refine(c[r - 1, col], c[r, col], c[r + 1, col])
    dc = refine(c[r, col - 1], c[r, col], c[r, col + 1])
    return (col + dc) - N // 2, (r + dr) - N // 2, float(c[r, col])


def to_meters(d_col: float, d_row: float, lat: float) -> tuple[float, float]:
    dx, dy = meters_per_px(lat)
    return d_col * dx, -d_row * dy  # east, north


def measure(name: str, lon: float, lat: float) -> dict:
    img, lon_left, lat_top = hirise_patch(lon, lat)
    lons, lats = pixel_lonlat(lon_left, lat_top)
    dx, dy = meters_per_px(lat)
    terrain = {"dtm": sample_dtm(lons, lats), "grid": sample_grid(lons, lats)}
    out = {"name": name, "lon": lon, "lat": lat, "bands": []}
    for fine, coarse in BANDS_M:
        image_band = band(img.astype(np.float64), dy, fine, coarse)
        # The sun direction of the image is found on the 1 m DTM and then used for the grid too.
        az, el, r0 = best_illumination(terrain["dtm"], image_band, dx, dy, fine, coarse)
        maps = {"image": image_band}
        for key, z in terrain.items():
            maps[key] = band(hillshade(z, dx, dy, az, el), dy, fine, coarse)
        entry = {"band_m": [fine, coarse], "sun_azimuth": az, "sun_elevation": el, "shading_corr": round(r0, 2)}
        for label, (a, b) in {"dtm_vs_image": ("dtm", "image"), "grid_vs_image": ("grid", "image"), "grid_vs_dtm": ("grid", "dtm")}.items():
            d_col, d_row, peak = shift_between(maps[a], maps[b])
            east, north = to_meters(d_col, d_row, lat)
            entry[label] = {"east_m": round(east, 1), "north_m": round(north, 1), "total_m": round(math.hypot(east, north), 1), "peak": round(peak, 2)}
        out["bands"].append(entry)
    out["_image"], out["_lonlat"] = img, (lon_left, lat_top)
    return out


def save_figure(res: dict, folder: Path, index: int) -> Path:
    """Side by side: the HiRISE tile crop, and the same crop with the red slope of OUR grid over it."""
    img = res["_image"]
    lons, lats = pixel_lonlat(*res["_lonlat"])
    dx, dy = meters_per_px(res["lat"])
    slope = np.degrees(np.arctan(np.hypot(*[g / s for g, s in zip(np.gradient(sample_grid(lons, lats))[::-1], (dx, dy))])))
    base = np.stack([img] * 3, axis=-1) / 255.0
    red = np.clip(slope / 25.0, 0, 1)[..., None] * np.array([1.0, 0.1, 0.1])
    blend = np.clip(base * (1 - 0.55 * np.clip(slope / 25.0, 0, 1)[..., None]) + 0.55 * red, 0, 1)
    side = np.hstack([base, blend])
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"alignment-{index}.jpg"
    Image.fromarray((side * 255).astype(np.uint8)).save(path, quality=82)
    return path


def main() -> None:
    folder = Path(sys.argv[sys.argv.index("--images") + 1]) if "--images" in sys.argv else None
    cell_x = (BBOX[2] - BBOX[0]) / WIDTH * math.radians(1) * MARS_RADIUS_APP_M * math.cos(math.radians(18.45))
    cell_y = (BBOX[3] - BBOX[1]) / HEIGHT * math.radians(1) * MARS_RADIUS_APP_M
    print(f"grid cell: {cell_x:.1f} m (x) x {cell_y:.1f} m (y); HiRISE tiles at zoom {ZOOM}, ~{meters_per_px(18.45)[1]:.2f} m/pixel")
    results = []
    for i, (name, lon, lat) in enumerate(FEATURES, 1):
        r = measure(name, lon, lat)
        print(f"\n{name} ({lon}, {lat})")
        for e in r["bands"]:
            print(f"  band {e['band_m'][0]}-{e['band_m'][1]} m, sun az {e['sun_azimuth']:.0f} el {e['sun_elevation']:.0f}, shading corr {e['shading_corr']}")
            for k in ("dtm_vs_image", "grid_vs_image", "grid_vs_dtm"):
                v = e[k]
                print(f"    {k:14s} east {v['east_m']:+6.1f} m  north {v['north_m']:+6.1f} m  total {v['total_m']:5.1f} m  peak {v['peak']:.2f}")
        if folder:
            print("  figure:", save_figure(r, folder, i))
        results.append({k: v for k, v in r.items() if not k.startswith("_")})
    if "--json" in sys.argv:
        Path(sys.argv[sys.argv.index("--json") + 1]).write_text(json.dumps(results, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
