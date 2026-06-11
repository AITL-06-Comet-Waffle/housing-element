import json
import os
import re
from decimal import Decimal
from datetime import date, datetime

import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5433/homebuyer_data",
)

OUTPUT_PATH = "postfire_pinecone_aggregates.jsonl"


def safe(value):
    if value is None:
        return "Not reported"

    value = str(value).strip()

    if value == "":
        return "Not reported"

    return value


def slug(value):
    value = safe(value).lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    value = value.strip("_")
    return value or "not_reported"


def json_safe(value):
    if isinstance(value, Decimal):
        return float(value)

    if isinstance(value, (date, datetime)):
        return value.isoformat()

    return value


def clean_metadata(metadata):
    cleaned = {}

    for key, value in metadata.items():
        value = json_safe(value)

        if value is None:
            continue

        if isinstance(value, str) and value.strip() == "":
            continue

        cleaned[key] = value

    return cleaned


def main():
    conn = psycopg2.connect(DATABASE_URL)

    query = """
    WITH grouped AS (
      SELECT
        incident_name,
        county,
        city,
        MIN(incident_start_date) AS incident_start_date,
        MIN(incident_year) AS incident_year,
        COUNT(*) AS inspection_count,

        COUNT(*) FILTER (WHERE damage = 'Destroyed (>50%)') AS destroyed_count,
        COUNT(*) FILTER (WHERE damage = 'Major (25-50%)') AS major_count,
        COUNT(*) FILTER (WHERE damage = 'Minor (10-25%)') AS minor_count,
        COUNT(*) FILTER (WHERE damage = 'Affected (>0-10%)') AS affected_count,
        COUNT(*) FILTER (WHERE damage = 'No Damage') AS no_damage_count,
        COUNT(*) FILTER (WHERE damage = 'Inaccessible') AS inaccessible_count,
        COUNT(*) FILTER (WHERE has_any_damage = true) AS any_damage_count,

        AVG(latitude) AS latitude,
        AVG(longitude) AS longitude,

        MODE() WITHIN GROUP (ORDER BY structure_type) AS common_structure_type,
        MODE() WITHIN GROUP (ORDER BY structure_category) AS common_structure_category,
        MODE() WITHIN GROUP (ORDER BY roof_construction) AS common_roof_construction,
        MODE() WITHIN GROUP (ORDER BY exterior_siding) AS common_exterior_siding,
        MODE() WITHIN GROUP (ORDER BY eaves) AS common_eaves,
        MODE() WITHIN GROUP (ORDER BY vent_screen) AS common_vent_screen,
        MODE() WITHIN GROUP (ORDER BY window_pane) AS common_window_pane,
        MODE() WITHIN GROUP (ORDER BY fence_attached_to_structure) AS common_fence_attached
      FROM postfire_damage_inspections
      WHERE incident_name IS NOT NULL
        AND county IS NOT NULL
      GROUP BY incident_name, county, city
    )
    SELECT *
    FROM grouped
    ORDER BY incident_year DESC NULLS LAST, incident_name, county, city;
    """

    count = 0

    with conn.cursor() as cur, open(OUTPUT_PATH, "w", encoding="utf-8") as outfile:
        cur.execute(query)

        columns = [desc[0] for desc in cur.description]

        for db_row in cur.fetchall():
            record = dict(zip(columns, db_row))

            incident_name = safe(record.get("incident_name"))
            county = safe(record.get("county"))
            city = safe(record.get("city"))

            record_id = (
                "calfire_dins_summary:"
                f"{slug(incident_name)}:"
                f"{slug(county)}:"
                f"{slug(city)}"
            )

            inspection_count = record.get("inspection_count") or 0
            destroyed_count = record.get("destroyed_count") or 0
            major_count = record.get("major_count") or 0
            minor_count = record.get("minor_count") or 0
            affected_count = record.get("affected_count") or 0
            no_damage_count = record.get("no_damage_count") or 0
            inaccessible_count = record.get("inaccessible_count") or 0
            any_damage_count = record.get("any_damage_count") or 0

            chunk_text = (
                "Post-fire damage inspection summary. "
                f"Incident: {incident_name}. "
                f"County: {county}. "
                f"City: {city}. "
                f"Incident start date: {safe(record.get('incident_start_date'))}. "
                f"Incident year: {safe(record.get('incident_year'))}. "
                f"Total inspection records: {inspection_count}. "
                f"Destroyed structures: {destroyed_count}. "
                f"Major damage records: {major_count}. "
                f"Minor damage records: {minor_count}. "
                f"Affected damage records: {affected_count}. "
                f"No damage records: {no_damage_count}. "
                f"Inaccessible records: {inaccessible_count}. "
                f"Any damage records: {any_damage_count}. "
                f"Common structure type: {safe(record.get('common_structure_type'))}. "
                f"Common structure category: {safe(record.get('common_structure_category'))}. "
                f"Common roof construction: {safe(record.get('common_roof_construction'))}. "
                f"Common exterior siding: {safe(record.get('common_exterior_siding'))}. "
                f"Common eaves: {safe(record.get('common_eaves'))}. "
                f"Common vent screen: {safe(record.get('common_vent_screen'))}. "
                f"Common window pane: {safe(record.get('common_window_pane'))}. "
                f"Common fence attached to structure: {safe(record.get('common_fence_attached'))}. "
                "For homebuyers, this summary indicates documented post-fire inspection outcomes "
                "for this incident and area. It should be combined with parcel-level location checks, "
                "current fire hazard zones, insurance review, defensible space review, and local disclosures."
            )

            metadata = clean_metadata(
                {
                    "source": "CAL_FIRE_DINS",
                    "dataset": "postfire_damage_inspection_summary",
                    "record_type": "incident_city_summary",
                    "incident_name": record.get("incident_name"),
                    "county": record.get("county"),
                    "city": record.get("city"),
                    "incident_start_date": record.get("incident_start_date"),
                    "incident_year": record.get("incident_year"),
                    "inspection_count": inspection_count,
                    "destroyed_count": destroyed_count,
                    "major_count": major_count,
                    "minor_count": minor_count,
                    "affected_count": affected_count,
                    "no_damage_count": no_damage_count,
                    "inaccessible_count": inaccessible_count,
                    "any_damage_count": any_damage_count,
                    "latitude": record.get("latitude"),
                    "longitude": record.get("longitude"),
                }
            )

            pinecone_record = {
                "_id": record_id,
                "chunk_text": chunk_text,
                "metadata": metadata,
            }

            outfile.write(json.dumps(pinecone_record, ensure_ascii=False) + "\n")
            count += 1

    conn.close()

    print(f"Wrote {count} aggregate Pinecone records to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()