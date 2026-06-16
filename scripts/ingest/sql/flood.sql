-- FEMA National Flood Hazard Layer (NFHL) flood-hazard areas (S_FLD_HAZ_AR),
-- reprojected to WGS84 (EPSG:4326). Applied idempotently by scripts/ingest/flood_nfhl.py.
--
-- flood_level is derived from the raw FEMA FLD_ZONE (+ ZONE_SUBTY):
--   High         Special Flood Hazard Area (A*, V*)  -- 1% annual chance
--   Moderate     shaded X (0.2% annual chance)
--   Minimal      unshaded X (minimal hazard)
--   Undetermined D (undetermined hazard)

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS hazard_flood (
  id          bigserial PRIMARY KEY,
  fld_zone    text,                                   -- raw FEMA FLD_ZONE (e.g. 'AE','VE','X','D')
  flood_level text NOT NULL,                          -- 'High'|'Moderate'|'Minimal'|'Undetermined'
  geom        geometry(MultiPolygon, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS hazard_flood_geom_gist ON hazard_flood USING GIST (geom);
