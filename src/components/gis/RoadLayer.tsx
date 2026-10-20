"use client";

import { GeoJSON } from "react-leaflet";
import type { PathOptions } from "leaflet";
import type { RoadSegment } from "@/types/road";
import { colorForPci } from "@/lib/map/pciColors";

interface RoadLayerProps {
  roads: RoadSegment[];
  selectedRoadId: string | null;
  onSelect: (road: RoadSegment) => void;
}

function styleForRoad(road: RoadSegment, selected: boolean): PathOptions {
  const isMajor =
    road.roadClass === "motorway" || road.roadClass === "trunk";
  const weight = selected ? (isMajor ? 6 : 4.5) : isMajor ? 4 : 2.5;

  return {
    color: colorForPci(road.latestPci),
    weight,
    opacity: selected ? 1 : road.latestPci === null ? 0.55 : 0.9,
    lineCap: "round",
    lineJoin: "round",
  };
}

export function RoadLayer({ roads, selectedRoadId, onSelect }: RoadLayerProps) {
  return (
    <>
      {roads.map((road) => (
        <GeoJSON
          key={`${road.id}-${road.updatedAt}`}
          data={road.geometryGeoJson}
          pathOptions={styleForRoad(road, road.id === selectedRoadId)}
          eventHandlers={{
            click: () => onSelect(road),
          }}
        />
      ))}
    </>
  );
}
