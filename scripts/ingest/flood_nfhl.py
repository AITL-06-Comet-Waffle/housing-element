"""Ingest FEMA NFHL flood-hazard areas (California) into PostGIS.

Loads FEMA's National Flood Hazard Layer flood zones into `hazard_flood`, deriving
a coarse level from the raw FLD_ZONE (+ ZONE_SUBTY). Run once; idempotent.

Source (default): FEMA's public NFHL MapServer, layer 28 ("Flood Hazard Zones" =
S_FLD_HAZ_AR), filtered to California via DFIRM_ID (state FIPS 06). This is the
heaviest layer — statewide CA is many polygons, so expect a few minutes of paging.

  https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28

Overrides (env): DATABASE_URL, FLOOD_SOURCE_URL, FLOOD_WHERE.

Network + database; run it yourself (never in tests):

  uv run --with geopandas --with sqlalchemy --with geoalchemy2 \\
         --with psycopg2-binary --with requests --with python-dotenv \\
         python scripts/ingest/flood_nfhl.py
"""

import os

import geopandas as gpd
from dotenv import load_dotenv

from _common import fetch_features, load_vector_layer

load_dotenv()

SOURCE_URL = os.getenv(
    "FLOOD_SOURCE_URL",
    "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28",
)
WHERE = os.getenv("FLOOD_WHERE", "DFIRM_ID LIKE '06%'")  # California (state FIPS 06)
PAGE = int(os.getenv("FLOOD_PAGE", "2000"))
# ~30m server-side generalization — FEMA 500s serializing its huge raw flood polygons otherwise.
SIMPLIFY = float(os.getenv("FLOOD_SIMPLIFY", "0.0003"))
DDL_PATH = os.path.join(os.path.dirname(__file__), "sql", "flood.sql")

# Special Flood Hazard Area codes (1% annual chance) -> High.
HIGH_ZONES = {"A", "AE", "AH", "AO", "AR", "A99", "V", "VE", "VO"}


def flood_level(fld_zone, zone_subty):
    """Derive {High|Moderate|Minimal|Undetermined} from FEMA codes; None to skip."""
    zone = str(fld_zone or "").strip().upper()
    subtype = str(zone_subty or "").strip().upper()
    if zone in HIGH_ZONES:
        return "High"
    if zone == "D":
        return "Undetermined"
    if zone == "X":
        return "Moderate" if "0.2 PCT" in subtype else "Minimal"  # shaded vs unshaded X
    return None  # AREA NOT INCLUDED / OPEN WATER / unrecognized -> drop


def main():
    print(f"Fetching FEMA NFHL flood zones (where: {WHERE})")
    features = fetch_features(
        SOURCE_URL, "FLD_ZONE,ZONE_SUBTY,DFIRM_ID", page=PAGE, where=WHERE, simplify=SIMPLIFY
    )
    gdf = gpd.GeoDataFrame.from_features(features, crs="EPSG:4326")
    if gdf.empty:
        raise SystemExit("No flood features returned (check FLOOD_WHERE / source).")

    subty = gdf["ZONE_SUBTY"] if "ZONE_SUBTY" in gdf.columns else [None] * len(gdf)
    gdf["flood_level"] = [flood_level(z, s) for z, s in zip(gdf["FLD_ZONE"], subty)]
    gdf["fld_zone"] = gdf["FLD_ZONE"]
    gdf = gdf[gdf["flood_level"].notna()][["fld_zone", "flood_level", "geometry"]]

    print(f"Classified {len(gdf)} flood polygons:")
    print(gdf.groupby("flood_level").size())
    load_vector_layer(gdf, "hazard_flood", DDL_PATH, ["fld_zone", "flood_level"])


if __name__ == "__main__":
    main()
