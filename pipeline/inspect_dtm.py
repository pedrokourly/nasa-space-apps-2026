"""Inspeciona o DTM HiRISE de Jezero (issue #22) e imprime os achados.

Uso (a partir da raiz do repositorio):
    pipeline/.venv/Scripts/python pipeline/inspect_dtm.py [caminho.tif]

So le metadados do GeoTIFF (e uma amostra em baixa resolucao para estimar
min/max); nao altera o arquivo.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling

DEFAULT = Path("data/raw/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif")
APP_RADIUS_M = 3_389_500.0  # raio de Marte usado no app (src/lib/geo.ts)


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    with rasterio.open(path) as ds:
        print(f"arquivo: {path.name}")
        print(f"driver: {ds.driver}  tamanho: {ds.width} x {ds.height}  bandas: {ds.count}")
        print(f"dtype: {ds.dtypes[0]}  nodata: {ds.nodata}")
        print(f"CRS (WKT):\n{ds.crs.to_wkt() if ds.crs else None}")
        print(f"transform: {ds.transform}")
        print(f"pixel (unidades do CRS): x={ds.res[0]} y={ds.res[1]}")
        print(f"bbox (unidades do CRS): {tuple(ds.bounds)}")
        print(f"tags: {ds.tags()}")
        print(f"tags banda 1: {ds.tags(1)}  descricao: {ds.descriptions[0]}  unidade: {ds.units[0]}")

        # Parametros da projecao (raio, paralelo padrao, meridiano central).
        crs = ds.crs
        try:
            print(f"PROJ4: {crs.to_proj4()}")
        except Exception as exc:  # pragma: no cover
            print(f"PROJ4 indisponivel: {exc}")

        # Estimativa em baixa resolucao (decimada) de min/max/nodata.
        scale = max(ds.width, ds.height) // 2048 or 1
        out_h, out_w = ds.height // scale, ds.width // scale
        arr = ds.read(1, out_shape=(out_h, out_w), resampling=Resampling.nearest, masked=True)
        print(f"amostra {out_w}x{out_h}: min={arr.min():.2f} max={arr.max():.2f} m, "
              f"pixels mascarados (nodata)={int(arr.mask.sum()) if np.ma.is_masked(arr) else 0}")

        # Varredura completa em faixas de linhas: nodata, min/max e bbox dos pixels validos.
        total = valid = 0
        vmin, vmax = math.inf, -math.inf
        rmin = rmax = cmin = cmax = None
        step = 512
        for r0 in range(0, ds.height, step):
            h = min(step, ds.height - r0)
            blk = ds.read(1, window=rasterio.windows.Window(0, r0, ds.width, h), masked=True)
            ok = ~np.ma.getmaskarray(blk)
            total += blk.size
            n = int(ok.sum())
            if n:
                valid += n
                vmin = min(vmin, float(blk.min()))
                vmax = max(vmax, float(blk.max()))
                rows = np.flatnonzero(ok.any(axis=1))
                cols = np.flatnonzero(ok.any(axis=0))
                rmin = r0 + int(rows[0]) if rmin is None else rmin
                rmax = r0 + int(rows[-1])
                cmin = int(cols[0]) if cmin is None else min(cmin, int(cols[0]))
                cmax = int(cols[-1]) if cmax is None else max(cmax, int(cols[-1]))
        print(f"VARREDURA COMPLETA: pixels={total} validos={valid} ({100 * valid / total:.1f}%) "
              f"nodata={total - valid} ({100 * (total - valid) / total:.1f}%)")
        print(f"elevacao valida: min={vmin:.2f} max={vmax:.2f} m")
        print(f"bbox dos pixels validos (linha {rmin}-{rmax}, coluna {cmin}-{cmax})")

        # Metros reais por pixel. Em Equirectangular com paralelo padrao 0,
        # x_solo = pixel * cos(lat); y_solo = pixel. Raio do proprio CRS.
        left, bottom, right, top = ds.bounds
        print(f"extensao: {(right - left) / 1000:.2f} km (x) x {(top - bottom) / 1000:.2f} km (y)")
        if crs and crs.is_projected:
            print("CRS e projetado: res em metros; ver metros por pixel acima e latitude de Jezero na secao abaixo.")
            # Lon/lat do centro e dos cantos
            from rasterio.warp import transform as warp_transform

            xs = [left, (left + right) / 2, right, (left + right) / 2]
            ys = [(bottom + top) / 2, top, (bottom + top) / 2, bottom]
            lons, lats = warp_transform(crs, crs.geodetic_crs, xs, ys)
            print("lon/lat (E, N, O, S, nesta ordem: esq, topo, dir, base):")
            for name, lo, la in zip(("esq", "topo", "dir", "base"), lons, lats):
                print(f"  {name}: lon={lo:.5f} lat={la:.5f}")
            lat = math.radians(18.4)
            ell = crs.ellipsoid_params if hasattr(crs, "ellipsoid_params") else None
            print(f"elipsoide: {ell}")
            print(f"cos(18,4 graus)={math.cos(lat):.5f}; raio do app={APP_RADIUS_M} m")
            for nome, la in (("base", lats[3]), ("centro", (lats[1] + lats[3]) / 2), ("topo", lats[1])):
                print(f"  m/pixel no solo em lat {la:.4f} ({nome}): x={ds.res[0] * math.cos(math.radians(la)):.4f} y={ds.res[1]:.4f}")


if __name__ == "__main__":
    main()
