"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { RoadClass, RoadSegment } from "@/types/road";
import type { SatelliteImageResponse } from "@/types/satellite";
import type { RoadAnalysisResult } from "@/types/analysis";
import { useRoadSelection } from "@/hooks/useRoadSelection";
import { useMapAoi } from "@/hooks/useMapAoi";
import { AppTopBar } from "@/components/dashboard/AppTopBar";
import {
  LayersPanel,
  type NetworkStats,
} from "@/components/dashboard/LayersPanel";
import { SegmentInspector } from "@/components/dashboard/SegmentInspector";
import { SatellitePreview } from "@/components/dashboard/SatellitePreview";
import {
  ReportPanel,
  type ReportViewModel,
} from "@/components/dashboard/ReportPanel";
import type { BasemapId } from "@/components/gis/BasemapToggle";
import { geocodeDefects } from "@/lib/map/defectGeo";
import { roadAnalysisWindow } from "@/lib/map/roadWindow";
import type { ReportExportPayload } from "@/lib/pdf/reportTypes";
import type { BBox } from "@/types/satellite";

const MapCanvas = dynamic(
  () =>
    import("@/components/gis/MapCanvas").then((mod) => ({
      default: mod.MapCanvas,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#eef1f4] text-[#6b7280]">
        <div className="text-center">
          <div className="mx-auto mb-3 h-9 w-9 animate-pulse rounded-2xl bg-[#d1d5db]" />
          <p className="text-[13px] font-medium">Ładowanie mapy…</p>
        </div>
      </div>
    ),
  },
);

interface FetchResponse {
  ok: boolean;
  cloudBlocked: boolean;
  threshold: number;
  image: SatelliteImageResponse;
  hdPreview?: {
    imageUrl: string;
    mimeType: string;
    width: number;
    height: number;
    source: "esri";
  } | null;
  visionSource?: "leo" | "esri";
  quality?: {
    cloudCoverage: number;
    textureScore: number;
    usable: boolean;
    reason: string;
  } | null;
  message?: string;
}

interface AnalysisResponse {
  ok: boolean;
  provider: string;
  modelId: string;
  report: {
    id: string;
    roadId: string;
    scanId: string;
    modelId: string;
    createdAt: string;
    result: RoadAnalysisResult;
  };
  evidence?: {
    imageUrl: string;
    bbox: BBox;
    width: number;
    height: number;
    source: "copernicus" | "esri" | "mock" | string;
  };
  message?: string;
  code?: string;
}

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function GisDashboard() {
  const { aoi, setAoi } = useMapAoi();
  const { selectedRoad, setSelectedRoad, clearSelection } = useRoadSelection();
  const [basemap, setBasemap] = useState<BasemapId>("osm");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<RoadClass | "all">("all");
  const [layersOpen, setLayersOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [scanPreview, setScanPreview] = useState<{
    image: SatelliteImageResponse;
    hdPreview?: FetchResponse["hdPreview"];
    visionSource?: "leo" | "esri";
    quality?: FetchResponse["quality"];
    cloudBlocked: boolean;
    threshold: number;
    message?: string;
  } | null>(null);
  const [reportView, setReportView] = useState<ReportViewModel | null>(null);
  const [selectedDefectIndex, setSelectedDefectIndex] = useState<number | null>(
    null,
  );
  const [loadingReport, setLoadingReport] = useState(false);
  const [stats, setStats] = useState<NetworkStats>({
    inView: 0,
    assessed: 0,
    loading: true,
  });
  const [mapNonce, setMapNonce] = useState(0);

  const handleStatsChange = useCallback((next: NetworkStats) => {
    setStats(next);
  }, []);

  const handleSelectRoad = useCallback(
    (road: RoadSegment) => {
      setLayersOpen(false);
      setSelectedRoad(road);
    },
    [setSelectedRoad],
  );

  const fetchSatelliteForBbox = useCallback(
    async (bbox: [number, number, number, number], roadId: string | null) => {
      setAnalyzing(true);
      setAnalyzeError(null);
      try {
        const response = await fetch("/api/satellite/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bbox,
            dateFrom: isoDateDaysAgo(60),
            dateTo: isoDateDaysAgo(0),
            evalscriptId: "true-color",
            roadId,
          }),
        });
        const data = (await response.json()) as FetchResponse & {
          message?: string;
        };
        if (!response.ok) {
          throw new Error(data.message ?? `HTTP ${response.status}`);
        }
        setScanPreview({
          image: data.image,
          hdPreview: data.hdPreview ?? null,
          visionSource: data.visionSource ?? "leo",
          quality: data.quality ?? null,
          cloudBlocked: data.cloudBlocked,
          threshold: data.threshold,
          message: data.message,
        });
      } catch (error) {
        setAnalyzeError(
          error instanceof Error ? error.message : "Błąd pobierania skanu",
        );
      } finally {
        setAnalyzing(false);
      }
    },
    [],
  );

  const handleAnalyzeAoi = useCallback(async () => {
    if (!aoi) {
      return;
    }
    await fetchSatelliteForBbox(aoi, selectedRoad?.id ?? null);
  }, [aoi, selectedRoad?.id, fetchSatelliteForBbox]);

  const handleAnalyzeSelectedRoad = useCallback(async () => {
    if (!selectedRoad) {
      return;
    }
    // ~2.5 km corridor so Sentinel-2 (~10 m/px) has enough native pixels.
    const window = roadAnalysisWindow(selectedRoad.geometryGeoJson, {
      maxLengthM: 2500,
      corridorHalfWidthM: 120,
    });
    await fetchSatelliteForBbox(window.bbox, selectedRoad.id);
  }, [selectedRoad, fetchSatelliteForBbox]);

  const handleAnalyzeAi = useCallback(async () => {
    if (!scanPreview) {
      return;
    }
    setAnalyzingAi(true);
    setAnalyzeError(null);
    try {
      const response = await fetch("/api/analysis/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanId: scanPreview.image.scanId,
          roadId: selectedRoad?.id ?? null,
        }),
      });
      const data = (await response.json()) as AnalysisResponse;
      if (!response.ok) {
        throw new Error(data.message ?? `HTTP ${response.status}`);
      }
      const evidenceUrl =
        data.evidence?.imageUrl ?? scanPreview.image.imageUrl;
      const evidenceBbox = data.evidence?.bbox ?? scanPreview.image.bbox;
      const analysisGeom = selectedRoad
        ? roadAnalysisWindow(selectedRoad.geometryGeoJson).geometry
        : null;
      const snapped = analysisGeom
        ? {
            ...data.report.result,
            surfaceDefects: geocodeDefects(
              data.report.result.surfaceDefects,
              evidenceBbox,
              analysisGeom,
            ),
          }
        : data.report.result;

      setScanPreview(null);
      setSelectedDefectIndex(
        snapped.surfaceDefects.length > 0 ? 0 : null,
      );
      setReportView({
        reportId: data.report.id,
        roadId: data.report.roadId,
        scanId: data.report.scanId,
        modelId: data.report.modelId,
        createdAt: data.report.createdAt,
        provider: data.provider,
        result: snapped,
        evidenceImageUrl: evidenceUrl,
        evidenceBbox: evidenceBbox,
        evidenceSourceLabel:
          data.visionSource === "esri" || data.evidence?.source === "esri"
            ? "Analiza AI na HD (fallback — LEO nieczytelny)"
            : data.evidence?.source === "copernicus" ||
                scanPreview.image.source === "copernicus"
              ? "Analiza AI na Sentinel-2 LEO"
              : "Podgląd zastępczy",
        roadGeometry: analysisGeom,
        road: selectedRoad
          ? {
              ref: selectedRoad.ref,
              name: selectedRoad.name,
              roadClass: selectedRoad.roadClass,
              osmId: selectedRoad.osmId,
            }
          : undefined,
      });
      setMapNonce((n) => n + 1);
    } catch (error) {
      setAnalyzeError(
        error instanceof Error ? error.message : "Błąd analizy AI",
      );
    } finally {
      setAnalyzingAi(false);
    }
  }, [scanPreview, selectedRoad]);

  const handleViewLatestReport = useCallback(async () => {
    if (!selectedRoad) {
      return;
    }
    setLoadingReport(true);
    setAnalyzeError(null);
    try {
      const response = await fetch(`/api/roads/${selectedRoad.id}/report`);
      const data = (await response.json()) as ReportExportPayload & {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message ?? `HTTP ${response.status}`);
      }

      let evidenceImageUrl: string | null = null;
      let evidenceBbox: BBox | null = null;
      try {
        const scanRes = await fetch(`/api/scans/${data.report.scanId}`);
        if (scanRes.ok) {
          const scanJson = (await scanRes.json()) as {
            scan?: SatelliteImageResponse;
          };
          evidenceImageUrl = scanJson.scan?.imageUrl ?? null;
          evidenceBbox = scanJson.scan?.bbox ?? null;
        }
      } catch {
        // optional evidence frame
      }

      const window = roadAnalysisWindow(selectedRoad.geometryGeoJson);
      const bbox = evidenceBbox ?? window.bbox;
      const snapped = {
        ...data.result,
        surfaceDefects: geocodeDefects(
          data.result.surfaceDefects,
          bbox,
          window.geometry,
        ),
      };

      setSelectedDefectIndex(
        snapped.surfaceDefects.length > 0 ? 0 : null,
      );
      setReportView({
        reportId: data.report.id,
        roadId: data.report.roadId,
        scanId: data.report.scanId,
        modelId: data.report.modelId,
        createdAt: data.report.createdAt,
        provider: data.report.provider,
        result: snapped,
        evidenceImageUrl,
        evidenceBbox: bbox,
        evidenceSourceLabel: "Esri — podgląd (nie LEO)",
        roadGeometry: window.geometry,
        road: data.road,
      });
    } catch (error) {
      setAnalyzeError(
        error instanceof Error ? error.message : "Błąd ładowania raportu",
      );
    } finally {
      setLoadingReport(false);
    }
  }, [selectedRoad]);

  useEffect(() => {
    window.dispatchEvent(new Event("resize"));
  }, [layersOpen, selectedRoad, basemap, scanPreview, reportView]);

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#eef1f4] text-[#111827]">
      <AppTopBar
        basemap={basemap}
        onBasemapChange={setBasemap}
        search={search}
        onSearchChange={setSearch}
        analyzeEnabled={Boolean(aoi)}
        analyzing={analyzing}
        onAnalyzeClick={() => {
          void handleAnalyzeAoi();
        }}
        layersOpen={layersOpen}
        onToggleLayers={() => setLayersOpen((open) => !open)}
      />

      {analyzeError ? (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-[12.5px] text-red-800">
          {analyzeError}
          <button
            type="button"
            className="ml-3 font-semibold underline"
            onClick={() => setAnalyzeError(null)}
          >
            Zamknij
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <LayersPanel
          stats={stats}
          classFilter={classFilter}
          onClassFilterChange={setClassFilter}
          aoiActive={Boolean(aoi)}
          mobileOpen={layersOpen}
          onMobileClose={() => setLayersOpen(false)}
        />

        <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <MapCanvas
            basemap={basemap}
            classFilter={classFilter}
            search={search}
            selectedRoad={selectedRoad}
            roadsRefreshToken={mapNonce}
            defectMarkers={reportView?.result.surfaceDefects ?? []}
            selectedDefectIndex={selectedDefectIndex}
            defectFitKey={reportView?.reportId}
            analysisAoi={reportView?.evidenceBbox}
            onSelectDefect={setSelectedDefectIndex}
            onAoiChange={setAoi}
            onSelectRoad={handleSelectRoad}
            onStatsChange={handleStatsChange}
          />
        </main>

        {reportView ? (
          <ReportPanel
            report={reportView}
            selectedDefectIndex={selectedDefectIndex}
            onSelectDefect={setSelectedDefectIndex}
            onClose={() => {
              setReportView(null);
              setSelectedDefectIndex(null);
            }}
          />
        ) : selectedRoad ? (
          <SegmentInspector
            road={selectedRoad}
            onClose={clearSelection}
            analyzing={analyzing}
            loadingReport={loadingReport}
            onAnalyze={() => {
              void handleAnalyzeSelectedRoad();
            }}
            onViewReport={() => {
              void handleViewLatestReport();
            }}
          />
        ) : null}
      </div>

      {scanPreview ? (
        <SatellitePreview
          image={scanPreview.image}
          hdPreview={scanPreview.hdPreview}
          visionSource={scanPreview.visionSource}
          quality={scanPreview.quality}
          cloudBlocked={scanPreview.cloudBlocked}
          threshold={scanPreview.threshold}
          message={scanPreview.message}
          analyzingAi={analyzingAi}
          onAnalyzeAi={() => {
            void handleAnalyzeAi();
          }}
          onClose={() => setScanPreview(null)}
        />
      ) : null}
    </div>
  );
}
