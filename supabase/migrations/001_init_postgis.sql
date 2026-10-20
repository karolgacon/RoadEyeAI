-- RoadEye AI — PostGIS schema (SRID 4326)
-- Run in Supabase SQL Editor if DATABASE_URL is not configured locally.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS roads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  osm_id TEXT UNIQUE,
  name TEXT,
  road_class TEXT NOT NULL,
  ref TEXT,
  geom GEOMETRY(LineString, 4326) NOT NULL,
  latest_pci SMALLINT CHECK (latest_pci BETWEEN 1 AND 5),
  latest_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS roads_geom_gix ON roads USING GIST (geom);

CREATE TABLE IF NOT EXISTS satellite_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  road_id UUID REFERENCES roads(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('copernicus', 'mock')),
  bbox GEOMETRY(Polygon, 4326) NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL,
  cloud_coverage REAL NOT NULL CHECK (cloud_coverage >= 0 AND cloud_coverage <= 1),
  image_path TEXT NOT NULL,
  bands TEXT[] NOT NULL,
  evalscript_id TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS satellite_scans_bbox_gix ON satellite_scans USING GIST (bbox);

CREATE TABLE IF NOT EXISTS analysis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  road_id UUID NOT NULL REFERENCES roads(id) ON DELETE CASCADE,
  scan_id UUID NOT NULL REFERENCES satellite_scans(id) ON DELETE CASCADE,
  pci_score SMALLINT NOT NULL CHECK (pci_score BETWEEN 1 AND 5),
  surface_defects JSONB NOT NULL,
  condition_description TEXT NOT NULL,
  probable_causes JSONB NOT NULL,
  recommendations JSONB NOT NULL,
  potential_hazards JSONB NOT NULL,
  confidence_score REAL NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  model_id TEXT NOT NULL,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analysis_reports_road_idx
  ON analysis_reports (road_id, created_at DESC);

-- Optional: create Storage bucket "satellite-images" in Supabase Dashboard (private).
