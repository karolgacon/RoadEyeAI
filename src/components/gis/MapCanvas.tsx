"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import type { RoadClass, RoadSegment } from "@/types/road";
import type { SurfaceDefect } from "@/types/analysis";
import type { BBox } from "@/types/satellite";
import {
  POLAND_CENTER,
  POLAND_DEFAULT_ZOOM,
  leafletBoundsToBbox,
} from "@/lib/map/geo";
import { AoiDrawControl } from "@/components/gis/AoiDrawControl";
import type { BasemapId } from "@/components/gis/BasemapToggle";
import { RoadLayer } from "@/components/gis/RoadLayer";
import { SegmentHighlight } from "@/components/gis/SegmentHighlight";
import { DefectMarkers } from "@/components/gis/DefectMarkers";
import type { NetworkStats } from "@/components/dashboard/LayersPanel";

import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

interface RoadsApiResponse {
  count: number;
  roads: RoadSegment[];
}

interface MapCanvasProps {
  basemap: BasemapId;
  classFilter: RoadClass | "all";
  search: string;
  selectedRoad: RoadSegment | null;
  defectMarkers?: SurfaceDefect[];
  selectedDefectIndex?: number | null;
  defectFitKey?: string;
  roadsRefreshToken?: number;
  onSelectDefect?: (index: number) => void;
  onAoiChange: (bbox: BBox | null) => void;
  onSelectRoad: (road: RoadSegment) => void;
  onStatsChange: (stats: NetworkStats) => void;
}

function ViewportRoadsLoader({
  onBbox,
}: {
  onBbox: (bbox: BBox) => void;
}) {
  const map = useMapEvents({
    moveend: () => {
      onBbox(leafletBoundsToBbox(map.getBounds()));
    },
    zoomend: () => {
      onBbox(leafletBoundsToBbox(map.getBounds()));
    },
  });

  useEffect(() => {
    onBbox(leafletBoundsToBbox(map.getBounds()));
  }, [map, onBbox]);

  return null;
}

function matchesSearch(road: RoadSegment, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) {
    return true;
  }
  return (
    (road.ref?.toLowerCase().includes(q) ?? false) ||
    (road.name?.toLowerCase().includes(q) ?? false)
  );
}

export function MapCanvas({
  basemap,
  classFilter,
  search,
  selectedRoad,
  defectMarkers = [],
  selectedDefectIndex = null,
  defectFitKey,
  roadsRefreshToken = 0,
  onSelectDefect,
  onAoiChange,
  onSelectRoad,
  onStatsChange,
}: MapCanvasProps) {
  const [viewportBbox, setViewportBbox] = useState<BBox | null>(null);
  const [roads, setRoads] = useState<RoadSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleViewport = useCallback((bbox: BBox) => {
    setViewportBbox(bbox);
  }, []);

  useEffect(() => {
    if (!viewportBbox) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const bboxParam = viewportBbox.join(",");
        const classParam =
          classFilter === "all" ? "" : `&class=${encodeURIComponent(classFilter)}`;
        const response = await fetch(
          `/api/roads?bbox=${encodeURIComponent(bboxParam)}&limit=2000${classParam}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          const body = (await response.json()) as { message?: string };
          throw new Error(body.message ?? `HTTP ${response.status}`);
        }
        const data = (await response.json()) as RoadsApiResponse;
        setRoads(data.roads);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        setError(err instanceof Error ? err.message : "Błąd ładowania dróg");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [viewportBbox, classFilter, roadsRefreshToken]);

  const visibleRoads = useMemo(() => {
    return roads.filter((road) => matchesSearch(road, search));
  }, [roads, search]);

  useEffect(() => {
    const assessed = visibleRoads.filter((road) => road.latestPci !== null).length;
    onStatsChange({
      inView: visibleRoads.length,
      assessed,
      loading,
    });
  }, [visibleRoads, loading, onStatsChange]);

  const tileUrl = useMemo(() => {
    if (basemap === "esri") {
      return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    }
    // Free OSM tiles — no API key required
    return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  }, [basemap]);

  const attribution =
    basemap === "esri"
      ? "Tiles &copy; Esri"
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  return (
    <div className="re-map-shell relative h-full w-full">
      <MapContainer
        center={POLAND_CENTER}
        zoom={POLAND_DEFAULT_ZOOM}
        minZoom={5}
        maxZoom={18}
        className="h-full w-full"
        zoomControl={false}
        preferCanvas
        scrollWheelZoom
      >
        <TileLayer url={tileUrl} attribution={attribution} />
        <ZoomControl position="bottomright" />
        <ViewportRoadsLoader onBbox={handleViewport} />
        <AoiDrawControl onAoiChange={onAoiChange} />
        <RoadLayer
          roads={visibleRoads}
          selectedRoadId={selectedRoad?.id ?? null}
          onSelect={onSelectRoad}
        />
        <SegmentHighlight road={selectedRoad} />
        {defectMarkers.length > 0 && onSelectDefect ? (
          <DefectMarkers
            defects={defectMarkers}
            selectedIndex={selectedDefectIndex}
            fitKey={defectFitKey}
            onSelect={onSelectDefect}
          />
        ) : null}
      </MapContainer>

      {defectMarkers.length > 0 ? (
        <div className="pointer-events-none absolute top-3 left-1/2 z-[1000] -translate-x-1/2 rounded-full border border-black/[0.08] bg-white/95 px-3 py-1.5 text-[11px] font-medium text-[#374151] shadow-sm">
          {defectMarkers.length}{" "}
          {defectMarkers.length === 1 ? "punkt problemu" : "punkty problemów"} na
          mapie
        </div>
      ) : null}

      {error ? (
        <div className="absolute bottom-4 left-1/2 z-[1000] -translate-x-1/2 rounded-xl border border-red-200 bg-white px-3 py-2 text-[12px] font-medium text-red-600 shadow-sm">
          {error}
        </div>
      ) : null}
    </div>
  );
}
