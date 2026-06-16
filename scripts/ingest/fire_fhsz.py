"""Ingest CAL FIRE Fire Hazard Severity Zones (FHSZ) into PostGIS.

Loads the statewide combined SRA + LRA layer into ``hazard_fhsz`` — the source of
truth for the wildfire lookup behind ``POST /api/risk``. Run once (the layer is
~static); re-running is idempotent (it truncates and reloads).

Source (default): CAL FIRE's public "FHSZ for Real Estate Inspections" feature
service. Its ``FHSZ_7Class`` field encodes BOTH responsibility area (SRA /
Reclassified LRA / Recommended LRA) and severity (Very High / High / Moderate) —
exactly the combined statewide coverage (wildland AND cities) a buyer-facing tool
needs. The LRA portion reflects the 2007-2011 + recommended maps; CAL FIRE's
newer (2025) LRA maps are a future refresh.

  https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/fhsz24_5/FeatureServer/0

Overrides (env):
  DATABASE_URL      Postgres URL (default: local homebuyer_data on :5433).
  FHSZ_SOURCE_URL   Alternate FeatureServer layer URL (ends in /FeatureServer/0).
  FHSZ_SOURCE_PATH  Local shapefile/zip/GeoJSON to read instead of fetching (a
                    fallback if the service is down; must carry FHSZ_7Class, or
                    set FHSZ_CLASS_FIELD).
  FHSZ_CLASS_FIELD  Name of the combined class field (default: FHSZ_7Class).

This script touches the network and the database — run it yourself; it is never
run by the test suite:

  uv run --with geopandas --with sqlalchemy --with geoalchemy2 \\
         --with psycopg2-binary --with requests --with python-dotenv \\
         python scripts/ingest/fire_fhsz.py
"""

import os

import geopandas as gpd
import psycopg2
import requests
from dotenv import load_dotenv
from sqlalchemy import create_engine

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5433/homebuyer_data",
)
SOURCE_URL = os.getenv(
    "FHSZ_SOURCE_URL",
    "https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/fhsz24_5/FeatureServer/0",
)
SOURCE_PATH = os.getenv("FHSZ_SOURCE_PATH")
CLASS_FIELD = os.getenv("FHSZ_CLASS_FIELD", "FHSZ_7Class")

DDL_PATH = os.path.join(os.path.dirname(__file__), "sql", "fhsz.sql")
STAGING_TABLE = "_staging_fhsz"
PAGE_SIZE = 2000
SEVERITIES = ("Very High", "High", "Moderate")  # checked longest-first so suffixes match exactly


def parse_class(raw):
    """Split a FHSZ_7Class value into ``(hazard_class, responsibility_area)``.

    Values look like 'SRA Very High', 'Reclassified LRA High', 'Recommended LRA
    Very High'. Returns ``(None, None)`` for anything unrecognized so it drops out.
    """
    text = str(raw).strip()
    area = "SRA" if text.startswith("SRA") else ("LRA" if "LRA" in text else None)
    for severity in SEVERITIES:  # 'Very High' before 'High' so the suffix match is exact
        if text.endswith(severity):
            return severity, area
    return None, None


def fetch_features(layer_url):
    """Page every feature (geometry + class field) from an ArcGIS FeatureServer layer."""
    features = []
    offset = 0
    while True:
        resp = requests.get(
            f"{layer_url}/query",
            params={
                "where": "1=1",
                "outFields": CLASS_FIELD,
                "outSR": 4326,
                "f": "geojson",
                "resultOffset": offset,
                "resultRecordCount": PAGE_SIZE,
            },
            timeout=180,
        )
        resp.raise_for_status()
        batch = resp.json().get("features", [])
        features.extend(batch)
        print(f"  fetched {len(features)} features...")
        if len(batch) < PAGE_SIZE:
            return features
        offset += len(batch)


def load_source():
    """Return a GeoDataFrame (EPSG:4326) carrying the combined class field."""
    if SOURCE_PATH:
        print(f"Reading FHSZ from local file: {SOURCE_PATH}")
        return gpd.read_file(SOURCE_PATH).to_crs(4326)
    print(f"Fetching FHSZ from feature service: {SOURCE_URL}")
    return gpd.GeoDataFrame.from_features(fetch_features(SOURCE_URL), crs="EPSG:4326")


def main():
    gdf = load_source()
    if gdf.empty:
        raise SystemExit("No features returned from the FHSZ source.")
    if CLASS_FIELD not in gdf.columns:
        raise SystemExit(
            f"Class field {CLASS_FIELD!r} not in source columns {list(gdf.columns)}; "
            "set FHSZ_CLASS_FIELD to the correct column."
        )

    parsed = gdf[CLASS_FIELD].map(parse_class)
    gdf["hazard_class"] = [cls for cls, _ in parsed]
    gdf["responsibility_area"] = [area for _, area in parsed]
    gdf = gdf[gdf["hazard_class"].isin(SEVERITIES)][
        ["hazard_class", "responsibility_area", "geometry"]
    ]
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]  # source has a few null shapes
    print(f"Parsed {len(gdf)} zoned polygons:")
    print(gdf.groupby(["responsibility_area", "hazard_class"]).size())

    with open(DDL_PATH, encoding="utf-8") as ddl_file:
        ddl = ddl_file.read()

    # Stage the clean frame, then INSERT...SELECT normalizes geometry into the
    # canonical table (valid MultiPolygon, 4326) decoupled from source quirks.
    engine = create_engine(DATABASE_URL)
    gdf.to_postgis(STAGING_TABLE, engine, if_exists="replace", index=False)
    engine.dispose()

    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(ddl)
            cur.execute("TRUNCATE hazard_fhsz RESTART IDENTITY;")
            cur.execute(
                f"""
                INSERT INTO hazard_fhsz (hazard_class, responsibility_area, geom)
                SELECT hazard_class, responsibility_area, geom
                FROM (
                  SELECT hazard_class, responsibility_area,
                         ST_Multi(ST_CollectionExtract(ST_MakeValid(geometry), 3)) AS geom
                  FROM {STAGING_TABLE}
                  WHERE hazard_class IN ('Very High', 'High', 'Moderate')
                    AND geometry IS NOT NULL
                ) cleaned
                WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom);
                """
            )
            cur.execute(f"DROP TABLE IF EXISTS {STAGING_TABLE};")
            conn.commit()

            cur.execute("SELECT COUNT(*) FROM hazard_fhsz;")
            total = cur.fetchone()[0]
            cur.execute(
                """
                SELECT hazard_class, responsibility_area
                FROM hazard_fhsz
                WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint(-118.4912, 34.0195), 4326))
                ORDER BY CASE hazard_class
                           WHEN 'Very High' THEN 3 WHEN 'High' THEN 2
                           WHEN 'Moderate' THEN 1 ELSE 0 END DESC
                LIMIT 1;
                """
            )
            sample = cur.fetchone()
    finally:
        conn.close()

    print(f"\nLoaded {total} rows into hazard_fhsz.")
    print(f"Malibu (-118.4912, 34.0195) -> {sample}")


if __name__ == "__main__":
    main()
