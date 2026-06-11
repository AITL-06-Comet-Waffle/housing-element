import csv
import json
from pathlib import Path

INPUT_CSV = Path("clean_postfire_damage_inspections.csv")
OUTPUT_JSONL = Path("postfire_pinecone_records.jsonl")


def clean_value(value):
    if value is None:
        return None

    value = str(value).strip()

    if value == "":
        return None

    return value


def to_int(value):
    value = clean_value(value)
    if value is None:
        return None

    try:
        return int(float(value))
    except ValueError:
        return None


def to_float(value):
    value = clean_value(value)
    if value is None:
        return None

    try:
        return float(value)
    except ValueError:
        return None


def to_bool(value):
    value = clean_value(value)
    if value is None:
        return None

    return value.lower() in {"true", "t", "yes", "y", "1"}


def build_chunk_text(row):
    parts = [
        "Post-fire damage inspection record.",
        f"Incident: {row.get('incident_name') or 'Not reported'}.",
        f"Incident start date: {row.get('incident_start_date') or 'Not reported'}.",
        f"Hazard type: {row.get('hazard_type') or 'Not reported'}.",
        f"County: {row.get('county') or 'Not reported'}.",
        f"City: {row.get('city') or 'Not reported'}.",
        f"Damage: {row.get('damage') or 'Not reported'}.",
        f"Structure type: {row.get('structure_type') or 'Not reported'}.",
        f"Structure category: {row.get('structure_category') or 'Not reported'}.",
        f"Year built: {row.get('year_built') or 'Not reported'}.",
        f"Roof construction: {row.get('roof_construction') or 'Not reported'}.",
        f"Eaves: {row.get('eaves') or 'Not reported'}.",
        f"Vent screen: {row.get('vent_screen') or 'Not reported'}.",
        f"Exterior siding: {row.get('exterior_siding') or 'Not reported'}.",
        f"Window pane: {row.get('window_pane') or 'Not reported'}.",
        f"Deck or porch on grade: {row.get('deck_porch_on_grade') or 'Not reported'}.",
        f"Elevated deck or porch: {row.get('deck_porch_elevated') or 'Not reported'}.",
        f"Fence attached to structure: {row.get('fence_attached_to_structure') or 'Not reported'}.",
        f"Structure defense actions: {row.get('structure_defense_actions') or 'Not reported'}.",
        f"Buyer summary: {row.get('buyer_summary_text') or 'Not reported'}",
    ]

    return " ".join(parts)


def build_record(row):
    record_id = clean_value(row.get("record_id"))

    metadata = {
        "source": "CAL_FIRE_DINS",
        "dataset": "postfire_damage_inspections",
        "object_id": to_int(row.get("object_id")),
        "global_id": clean_value(row.get("global_id")),
        "damage": clean_value(row.get("damage")),
        "damage_rank": to_int(row.get("damage_rank")),
        "has_any_damage": to_bool(row.get("has_any_damage")),
        "has_destroyed_damage": to_bool(row.get("has_destroyed_damage")),
        "structure_type": clean_value(row.get("structure_type")),
        "structure_category": clean_value(row.get("structure_category")),
        "city": clean_value(row.get("city")),
        "county": clean_value(row.get("county")),
        "incident_name": clean_value(row.get("incident_name")),
        "incident_number": clean_value(row.get("incident_number")),
        "incident_start_date": clean_value(row.get("incident_start_date")),
        "incident_year": to_int(row.get("incident_year")),
        "hazard_type": clean_value(row.get("hazard_type")),
        "apn": clean_value(row.get("apn")),
        "year_built": to_int(row.get("year_built")),
        "site_address": clean_value(row.get("site_address")),
        "latitude": to_float(row.get("latitude")),
        "longitude": to_float(row.get("longitude")),
    }

    # Pinecone metadata cannot contain null values.
    metadata = {
        key: value
        for key, value in metadata.items()
        if value is not None
    }

    return {
        "_id": record_id,
        "chunk_text": build_chunk_text(row),
        "metadata": metadata,
    }


def main():
    if not INPUT_CSV.exists():
        raise FileNotFoundError(f"Could not find {INPUT_CSV}")

    count = 0

    with INPUT_CSV.open("r", encoding="utf-8", newline="") as infile, OUTPUT_JSONL.open(
        "w", encoding="utf-8"
    ) as outfile:
        reader = csv.DictReader(infile)

        for row in reader:
            record = build_record(row)

            if not record["_id"]:
                continue

            outfile.write(json.dumps(record, ensure_ascii=False) + "\n")
            count += 1

    print(f"Wrote {count} records to {OUTPUT_JSONL}")


if __name__ == "__main__":
    main()