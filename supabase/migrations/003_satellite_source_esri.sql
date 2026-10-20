-- Allow Esri World Imagery snapshots as a satellite source (preview mode).

ALTER TABLE satellite_scans
  DROP CONSTRAINT IF EXISTS satellite_scans_source_check;

ALTER TABLE satellite_scans
  ADD CONSTRAINT satellite_scans_source_check
  CHECK (source IN ('copernicus', 'esri', 'mock'));
