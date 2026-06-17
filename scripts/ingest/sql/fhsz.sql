-- Canonical wildfire hazard layer: CAL FIRE Fire Hazard Severity Zones (FHSZ).
-- State + Local Responsibility Areas combined, reprojected to WGS84 (EPSG:4326).
--
-- Applied (idempotently) by scripts/ingest/fire_fhsz.py before it loads data; can
-- also be run by hand:  psql "$DATABASE_URL" -f scripts/ingest/sql/fhsz.sql
--
-- The loader writes each source into a staging table, then INSERT...SELECTs the
-- normalized rows into hazard_fhsz, so this canonical schema stays decoupled from
-- the messy, source-specific columns.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS hazard_fhsz (
  id                  bigserial PRIMARY KEY,
  hazard_class        text NOT NULL,                  -- 'Very High' | 'High' | 'Moderate'
  responsibility_area text NOT NULL,                  -- 'SRA' | 'LRA'
  geom                geometry(MultiPolygon, 4326) NOT NULL
);

-- Spatial index: the point-in-polygon lookup (ST_Contains) is the hot path.
CREATE INDEX IF NOT EXISTS hazard_fhsz_geom_gist ON hazard_fhsz USING GIST (geom);
