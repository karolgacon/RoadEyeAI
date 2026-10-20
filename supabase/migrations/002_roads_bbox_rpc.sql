-- Spatial query helper for viewport loading (never load full PL at once).

CREATE OR REPLACE FUNCTION roads_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  max_rows integer DEFAULT 2000
)
RETURNS TABLE (
  id uuid,
  osm_id text,
  name text,
  road_class text,
  ref text,
  latest_pci smallint,
  latest_analyzed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  geojson json
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    r.id,
    r.osm_id,
    r.name,
    r.road_class,
    r.ref,
    r.latest_pci,
    r.latest_analyzed_at,
    r.created_at,
    r.updated_at,
    ST_AsGeoJSON(r.geom)::json AS geojson
  FROM roads r
  WHERE r.geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    AND ST_Intersects(
      r.geom,
      ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    )
  ORDER BY
    CASE r.road_class
      WHEN 'motorway' THEN 1
      WHEN 'trunk' THEN 2
      WHEN 'primary' THEN 3
      WHEN 'secondary' THEN 4
      ELSE 5
    END,
    r.ref NULLS LAST
  LIMIT GREATEST(1, LEAST(max_rows, 5000));
$$;

GRANT EXECUTE ON FUNCTION roads_in_bbox(double precision, double precision, double precision, double precision, integer)
  TO anon, authenticated, service_role;
