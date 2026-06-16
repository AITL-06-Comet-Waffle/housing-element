"""Shared helpers for the scripts/ingest hazard loaders (run-once ETL).

Each loader builds a clean GeoDataFrame (EPSG:4326) with its value columns + a
geometry column, then calls load_vector_layer() to apply DDL and INSERT normalized
MultiPolygons into the canonical table. These touch the network and the database;
they are never run by the test suite.
"""

import os

import psycopg2
from sqlalchemy import create_engine

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5433/homebuyer_data",
)

# (name, lon, lat) — known CA points for a post-load sanity print.
SANITY_POINTS = [
    ("Santa Monica Mtns", -118.78, 34.095),
    ("Paradise (Camp Fire)", -121.6175, 39.7596),
    ("Downtown LA", -118.2437, 34.0522),
    ("Downtown SF", -122.4194, 37.7749),
    ("Sacramento (Central Valley)", -121.4944, 38.5816),
]


def fetch_features(layer_url, out_fields, page=2000, where="1=1", simplify=None):
    """Page all features (geometry + out_fields) from an ArcGIS layer as GeoJSON.

    Retries each page a few times so a long pull survives transient 500s/timeouts.
    `simplify` sets maxAllowableOffset (degrees) for server-side generalization —
    needed for layers whose raw polygons are too large to serialize.
    """
    import time

    import requests

    features, offset = [], 0
    params = {
        "where": where,
        "outFields": out_fields,
        "outSR": 4326,
        "f": "geojson",
        "geometryPrecision": 6,
        "resultRecordCount": page,
    }
    if simplify:
        params["maxAllowableOffset"] = simplify
    while True:
        for attempt in range(4):
            try:
                resp = requests.get(
                    f"{layer_url}/query", params={**params, "resultOffset": offset}, timeout=180
                )
                resp.raise_for_status()
                break
            except requests.RequestException as err:
                if attempt == 3:
                    raise
                print(f"  page at offset {offset} failed ({err}); retrying...")
                time.sleep(2**attempt)
        batch = resp.json().get("features", [])
        features.extend(batch)
        print(f"  fetched {len(features)} features...")
        if len(batch) < page:
            return features
        offset += len(batch)


def load_vector_layer(gdf, table, ddl_path, value_columns):
    """Stage a clean GeoDataFrame and INSERT normalized MultiPolygons into `table`.

    gdf must contain exactly value_columns + an active 'geometry' column (EPSG:4326).
    Applies ddl_path (idempotent), truncates, inserts valid MultiPolygons, drops the
    staging table, and prints the row count + a known-point sanity check.
    """
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]
    staging = f"_staging_{table}"

    engine = create_engine(DATABASE_URL)
    gdf[value_columns + ["geometry"]].to_postgis(staging, engine, if_exists="replace", index=False)
    engine.dispose()

    prefix = "".join(f"{c}, " for c in value_columns)  # 'a, b, ' or ''
    with open(ddl_path, encoding="utf-8") as ddl_file:
        ddl = ddl_file.read()

    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(ddl)
            cur.execute(f"TRUNCATE {table} RESTART IDENTITY;")
            cur.execute(
                f"""
                INSERT INTO {table} ({prefix}geom)
                SELECT {prefix}geom FROM (
                  SELECT {prefix}ST_Multi(ST_CollectionExtract(ST_MakeValid(geometry), 3)) AS geom
                  FROM {staging}
                  WHERE geometry IS NOT NULL
                ) cleaned
                WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom);
                """
            )
            cur.execute(f"DROP TABLE IF EXISTS {staging};")
            conn.commit()

            cur.execute(f"SELECT COUNT(*) FROM {table};")
            print(f"\nLoaded {cur.fetchone()[0]} rows into {table}.")
            for name, lon, lat in SANITY_POINTS:
                point = "ST_SetSRID(ST_MakePoint(%s, %s), 4326)"
                if value_columns:
                    cur.execute(
                        f"SELECT {', '.join(value_columns)} FROM {table} "
                        f"WHERE ST_Contains(geom, {point}) LIMIT 1;",
                        (lon, lat),
                    )
                    row = cur.fetchone()
                    print(f"  {name}: {row if row else 'None'}")
                else:
                    cur.execute(
                        f"SELECT EXISTS(SELECT 1 FROM {table} WHERE ST_Contains(geom, {point}));",
                        (lon, lat),
                    )
                    print(f"  {name}: {'in zone' if cur.fetchone()[0] else 'not in zone'}")
    finally:
        conn.close()
