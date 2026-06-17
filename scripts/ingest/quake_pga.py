"""Ingest USGS PGA (2% in 50yr) ground-shaking bands into PostGIS.

The USGS National Seismic Hazard Model ships PGA as a 0.05-degree gridded CSV (no
GeoTIFF, no header row): columns are lon, lat, PGA, SA_0.2s, SA_1s, SA_5s. We clip
to California, bin PGA into severity bands, turn each grid point into a 0.05-degree
cell polygon, and load `hazard_pga(pga_band, geom)` so the runtime query is plain
point-in-polygon (no postgis_raster). Run once; idempotent.

Source (default): ScienceBase US 2018 NSHM, 2% in 50yr, B/C (firm rock) PGA CSV.

Overrides (env):
  DATABASE_URL
  PGA_SOURCE_PATH  Local CSV to read instead of downloading (recommended if the
                   ScienceBase URL is slow/unreachable).
  PGA_SOURCE_URL   Alternate CSV URL.
  PGA_SCALE        Multiply CSV values to get g (default 1.0; set 0.01 if the
                   printed range looks like %g, e.g. 0-150).
  PGA_CELL_DEG     Grid spacing in degrees (default 0.05).

Network + database; run it yourself (never in tests):

  uv run --with geopandas --with sqlalchemy --with geoalchemy2 \\
         --with psycopg2-binary --with python-dotenv \\
         python scripts/ingest/quake_pga.py
"""

import os

import geopandas as gpd
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from shapely.geometry import box

from _common import load_vector_layer

load_dotenv()

PGA_SOURCE_PATH = os.getenv("PGA_SOURCE_PATH")
PGA_SOURCE_URL = os.getenv(
    "PGA_SOURCE_URL",
    "https://www.sciencebase.gov/catalog/file/get/5d5597d0e4b01d82ce8e3ff1"
    "?f=__disk__e2%2Fa2%2F02%2Fe2a202a984d3c7c19e4de16cbd8d662baf113898",
)
PGA_SCALE = float(os.getenv("PGA_SCALE", "1.0"))
CELL = float(os.getenv("PGA_CELL_DEG", "0.05"))
DDL_PATH = os.path.join(os.path.dirname(__file__), "sql", "quake_pga.sql")

CA_BBOX = (-124.6, 32.4, -113.9, 42.1)  # lon_min, lat_min, lon_max, lat_max
BREAKS = [0.2, 0.4, 0.6]  # g
LABELS = ["< 0.2 g", "0.2-0.4 g", "0.4-0.6 g", ">= 0.6 g"]


def main():
    source = PGA_SOURCE_PATH or PGA_SOURCE_URL
    print(f"Reading USGS PGA grid: {source}")
    # The USGS CSV has no header; columns are positional: lon, lat, PGA, SA_*.
    df = pd.read_csv(source, header=None, comment="#")
    try:
        float(df.iloc[0, 0])
    except (ValueError, TypeError):
        df = df.iloc[1:].reset_index(drop=True)  # tolerate a header row if a variant has one

    lon = pd.to_numeric(df.iloc[:, 0], errors="coerce")
    lat = pd.to_numeric(df.iloc[:, 1], errors="coerce")
    pga = pd.to_numeric(df.iloc[:, 2], errors="coerce") * PGA_SCALE
    keep = lon.between(CA_BBOX[0], CA_BBOX[2]) & lat.between(CA_BBOX[1], CA_BBOX[3]) & pga.notna()
    lon, lat, pga = lon[keep], lat[keep], pga[keep]

    print(
        f"CA grid points: {len(lon)}; PGA range {pga.min():.3f}-{pga.max():.3f} g "
        "(if this looks like 0-100+, the data is %g — set PGA_SCALE=0.01 and re-run)"
    )

    band = np.digitize(pga.to_numpy(), BREAKS)
    half = CELL / 2.0
    cells = [box(x - half, y - half, x + half, y + half) for x, y in zip(lon, lat)]
    gdf = gpd.GeoDataFrame(
        {"pga_band": [LABELS[i] for i in band]}, geometry=cells, crs="EPSG:4326"
    )
    print(gdf.groupby("pga_band").size())
    load_vector_layer(gdf, "hazard_pga", DDL_PATH, ["pga_band"])


if __name__ == "__main__":
    main()
