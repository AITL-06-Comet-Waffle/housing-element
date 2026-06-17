-- California Geological Survey Alquist-Priolo Earthquake Fault Zones (regulatory
-- surface-rupture zones), reprojected to WGS84 (EPSG:4326). Membership is the
-- signal (in a zone or not), so only the geometry is stored.
-- Applied idempotently by scripts/ingest/quake_ap.py.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS hazard_ap_zones (
  id   bigserial PRIMARY KEY,
  geom geometry(MultiPolygon, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS hazard_ap_zones_geom_gist ON hazard_ap_zones USING GIST (geom);
