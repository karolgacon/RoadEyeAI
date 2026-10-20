import { analyzeWithGemini } from "@/lib/ai/gemini";
import { createMockRoadAnalysis } from "@/lib/ai/mock";
import { getAppEnv } from "@/lib/utils/env";
import { geocodeDefects } from "@/lib/map/defectGeo";
import type { RoadAnalysisResult } from "@/types/analysis";
import type { BBox } from "@/types/satellite";
import { CloudBlockedError } from "@/lib/satellite/errors";

export interface VisionAnalysisInput {
  imageUrl: string;
  bbox: BBox;
  cloudCoverage: number;
  evalscriptId: string;
  source: string;
  roadGeometry?: GeoJSON.LineString | GeoJSON.MultiLineString | null;
}

export interface VisionAnalysisOutput {
  result: RoadAnalysisResult;
  modelId: string;
  provider: "gemini" | "mock";
  raw: unknown;
}

function withGeocodedDefects(
  result: RoadAnalysisResult,
  bbox: BBox,
  roadGeometry?: GeoJSON.LineString | GeoJSON.MultiLineString | null,
): RoadAnalysisResult {
  return {
    ...result,
    surfaceDefects: geocodeDefects(
      result.surfaceDefects,
      bbox,
      roadGeometry,
    ),
  };
}

export async function runRoadVisionAnalysis(
  input: VisionAnalysisInput,
): Promise<VisionAnalysisOutput> {
  const env = getAppEnv();

  if (input.cloudCoverage > env.cloudCoverageThreshold) {
    throw new CloudBlockedError(input.cloudCoverage, env.cloudCoverageThreshold);
  }

  const provider = env.aiProvider;
  const hasGeminiKey = Boolean(env.googleGenerativeAiApiKey);

  if (provider === "gemini" && hasGeminiKey) {
    try {
      const { result, modelId, raw } = await analyzeWithGemini(input);
      return {
        result: withGeocodedDefects(result, input.bbox, input.roadGeometry),
        modelId,
        provider: "gemini",
        raw,
      };
    } catch (error) {
      console.warn(
        "[RoadEye AI] Gemini failed, falling back to mock:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (provider === "gemini" && !hasGeminiKey) {
    console.warn(
      "[RoadEye AI] Brak GOOGLE_GENERATIVE_AI_API_KEY — używam AI mock",
    );
  }

  const result = createMockRoadAnalysis({
    bbox: input.bbox,
    cloudCoverage: input.cloudCoverage,
    roadGeometry: input.roadGeometry,
  });
  return {
    result: withGeocodedDefects(result, input.bbox, input.roadGeometry),
    modelId: "mock-vision-v1",
    provider: "mock",
    raw: result,
  };
}
