-- Canonical housing APR summary table.
--
-- Applied (idempotently) by scripts/ingest/apr_housing.py before it loads data; can
-- also be run by hand:  psql "$DATABASE_URL" -f scripts/ingest/sql/apr.sql
--

CREATE TABLE IF NOT EXISTS housing_apr_summary (
  id                          bigserial PRIMARY KEY,
  juris_name                  text NOT NULL,
  year                        integer NOT NULL,
  total_proposed_units        numeric,
  total_approved_units        numeric,
  total_disapproved_units     numeric,
  total_building_permits      numeric,
  total_completed_units       numeric,
  total_affordable_permits    numeric,
  total_market_rate_permits   numeric
);

CREATE INDEX IF NOT EXISTS housing_apr_summary_juris_name_idx ON housing_apr_summary (juris_name);
CREATE INDEX IF NOT EXISTS housing_apr_summary_year_idx ON housing_apr_summary (year);
