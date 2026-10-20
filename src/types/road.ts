import type { PciScore } from "@/types/pci";

export type RoadClass =
  | "motorway"
  | "trunk"
  | "primary"
  | "secondary"
  | "tertiary"
  | "unclassified";

export interface RoadSegment {
  id: string;
  osmId: string | null;
  name: string | null;
  roadClass: RoadClass;
  ref: string | null;
  geometryGeoJson: GeoJSON.LineString | GeoJSON.MultiLineString;
  latestPci: PciScore | null;
  latestAnalyzedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
