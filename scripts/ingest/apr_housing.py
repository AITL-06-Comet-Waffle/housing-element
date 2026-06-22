"""Ingest APR housing data into PostgreSQL.

Loads the ca_apr_data_exploration/jurisdiction_housing_summary.csv into
the housing_apr_summary table.

Overrides (env):
  DATABASE_URL      Postgres URL (default: local homebuyer_data on :5433).
"""

import os
import pandas as pd
import psycopg2
from dotenv import load_dotenv
from sqlalchemy import create_engine

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5433/homebuyer_data",
)
CSV_PATH = os.path.join(
    os.path.dirname(__file__), "..", "ca_apr_data_exploration", "jurisdiction_housing_summary.csv"
)
DDL_PATH = os.path.join(os.path.dirname(__file__), "sql", "apr.sql")
TABLE_NAME = "housing_apr_summary"
STAGING_TABLE = "_staging_apr"

def main():
    if not os.path.exists(CSV_PATH):
        raise SystemExit(f"CSV file not found: {CSV_PATH}")

    print(f"Reading CSV from {CSV_PATH}")
    df = pd.read_csv(CSV_PATH)
    # clean column names to lowercase to match database
    df.columns = [col.lower() for col in df.columns]

    print(f"Read {len(df)} rows.")

    with open(DDL_PATH, encoding="utf-8") as ddl_file:
        ddl = ddl_file.read()

    engine = create_engine(DATABASE_URL)
    
    # Write to staging
    df.to_sql(STAGING_TABLE, engine, if_exists="replace", index=False)
    engine.dispose()

    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(ddl)
            cur.execute(f"TRUNCATE {TABLE_NAME} RESTART IDENTITY;")
            
            columns = ", ".join(df.columns)
            cur.execute(
                f"""
                INSERT INTO {TABLE_NAME} ({columns})
                SELECT {columns}
                FROM {STAGING_TABLE};
                """
            )
            cur.execute(f"DROP TABLE IF EXISTS {STAGING_TABLE};")
            conn.commit()

            cur.execute(f"SELECT COUNT(*) FROM {TABLE_NAME};")
            total = cur.fetchone()[0]
    finally:
        conn.close()

    print(f"\\nLoaded {total} rows into {TABLE_NAME}.")

if __name__ == "__main__":
    main()
