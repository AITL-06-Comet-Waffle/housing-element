-- USGS Peak Ground Acceleration (2% in 50yr) vectorized into severity bands and
-- reprojected to WGS84 (EPSG:4326). The continuous raster is reclassified into
-- band polygons by scripts/ingest/quake_pga.py, then point-in-polygon queried
-- exactly like the other vector layers (no postgis_raster).
--
-- pga_band ∈ {'< 0.2 g', '0.2-0.4 g', '0.4-0.6 g', '>= 0.6 g'}

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS hazard_pga (
  id       bigserial PRIMARY KEY,
  pga_band text NOT NULL,
  geom     geometry(MultiPolygon, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS hazard_pga_geom_gist ON hazard_pga USING GIST (geom);
