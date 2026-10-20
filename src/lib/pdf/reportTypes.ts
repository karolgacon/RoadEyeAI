import type { RoadAnalysisResult } from "@/types/analysis";

export interface ReportExportPayload {
  exportVersion: 1;
  generatedAt: string;
  app: "RoadEye AI";
  report: {
    id: string;
    roadId: string;
    scanId: string;
    modelId: string;
    createdAt: string;
    provider?: string;
  };
  road?: {
    ref: string | null;
    name: string | null;
    roadClass: string | null;
    osmId: string | null;
  };
  result: RoadAnalysisResult;
}

export function buildReportExportPayload(input: {
  reportId: string;
  roadId: string;
  scanId: string;
  modelId: string;
  createdAt: string;
  result: RoadAnalysisResult;
  provider?: string;
  road?: ReportExportPayload["road"];
}): ReportExportPayload {
  return {
    exportVersion: 1,
    generatedAt: new Date().toISOString(),
    app: "RoadEye AI",
    report: {
      id: input.reportId,
      roadId: input.roadId,
      scanId: input.scanId,
      modelId: input.modelId,
      createdAt: input.createdAt,
      provider: input.provider,
    },
    road: input.road,
    result: input.result,
  };
}
