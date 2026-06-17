"""Ingest CA Alquist-Priolo Earthquake Fault Zones into PostGIS.

Loads the CGS regulatory surface-rupture zone polygons into `hazard_ap_zones`
(membership only — a point is in a zone or not). Run once; idempotent.

Source (default): the CA Dept. of Conservation / CGS layer on ArcGIS Online (the
state server endpoint is unreliable). Native CRS is 3310; we request outSR=4326.

  https://services2.arcgis.com/zr3KAIbsRSUyARHG/arcgis/rest/services/CGS_Alquist_Priolo_Fault_Zones/FeatureServer/0

Overrides (env): DATABASE_URL, AP_SOURCE_URL.

Network + database; run it yourself (never in tests):

  uv run --with geopandas --with sqlalchemy --with geoalchemy2 \\
         --with psycopg2-binary --with requests --with python-dotenv \\
         python scripts/ingest/quake_ap.py
"""

import os

import geopandas as gpd
from dotenv import load_dotenv

from _common import fetch_features, load_vector_layer

load_dotenv()

SOURCE_URL = os.getenv(
    "AP_SOURCE_URL",
    "https://services2.arcgis.com/zr3KAIbsRSUyARHG/arcgis/rest/services/"
    "CGS_Alquist_Priolo_Fault_Zones/FeatureServer/0",
)
DDL_PATH = os.path.join(os.path.dirname(__file__), "sql", "quake_ap.sql")


def main():
    print(f"Fetching Alquist-Priolo fault zones: {SOURCE_URL}")
    features = fetch_features(SOURCE_URL, "OBJECTID")
    gdf = gpd.GeoDataFrame.from_features(features, crs="EPSG:4326")
    if gdf.empty:
        raise SystemExit("No Alquist-Priolo features returned.")

    print(f"Loaded {len(gdf)} AP fault-zone polygons.")
    load_vector_layer(gdf[["geometry"]], "hazard_ap_zones", DDL_PATH, [])


if __name__ == "__main__":
    main()
