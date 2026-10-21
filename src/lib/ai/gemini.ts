import {
  GoogleGenerativeAI,
  SchemaType,
  type ResponseSchema,
} from "@google/generative-ai";
import { roadAnalysisResultSchema } from "@/lib/ai/schema";
import {
  ROAD_ANALYSIS_SYSTEM_PROMPT,
  buildRoadAnalysisUserPrompt,
} from "@/lib/ai/prompt";
import { prepareImageForVision } from "@/lib/ai/imageForVision";
import type { RoadAnalysisResult } from "@/types/analysis";
import type { BBox } from "@/types/satellite";
import { getAppEnv } from "@/lib/utils/env";

const responseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    pciScore: { type: SchemaType.INTEGER },
    surfaceDefects: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          type: { type: SchemaType.STRING },
          severity: { type: SchemaType.INTEGER },
          locationHint: { type: SchemaType.STRING },
          evidenceNote: { type: SchemaType.STRING },
          alongRoad: { type: SchemaType.NUMBER },
          relativeX: { type: SchemaType.NUMBER },
          relativeY: { type: SchemaType.NUMBER },
          relativeW: { type: SchemaType.NUMBER },
          relativeH: { type: SchemaType.NUMBER },
        },
        required: ["type", "severity", "locationHint"],
      },
    },
    conditionDescription: { type: SchemaType.STRING },
    probableCauses: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    recommendations: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    potentialHazards: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    confidenceScore: { type: SchemaType.NUMBER },
  },
  required: [
    "pciScore",
    "surfaceDefects",
    "conditionDescription",
    "probableCauses",
    "recommendations",
    "potentialHazards",
    "confidenceScore",
  ],
};

function parseDataUrl(imageUrl: string): { mimeType: string; data: string } {
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(imageUrl);
  if (!match) {
    throw new Error("Gemini wymaga obrazu jako data URL base64");
  }
  return { mimeType: match[1], data: match[2] };
}

async function toInlineImage(
  imageUrl: string,
): Promise<{ mimeType: string; data: string }> {
  let mimeType: string;
  let data: string;
  if (imageUrl.startsWith("data:")) {
    ({ mimeType, data } = parseDataUrl(imageUrl));
  } else {
    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new Error(
        `Nie udało się pobrać obrazu do Vision (${response.status})`,
      );
    }
    mimeType = response.headers.get("content-type") ?? "image/png";
    data = Buffer.from(await response.arrayBuffer()).toString("base64");
  }

  return prepareImageForVision({ mimeType, base64: data });
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    }
    throw new Error("Model nie zwrócił poprawnego JSON");
  }
}

export async function analyzeWithGemini(params: {
  imageUrl: string;
  bbox: BBox;
  cloudCoverage: number;
  evalscriptId: string;
  source: string;
}): Promise<{ result: RoadAnalysisResult; modelId: string; raw: unknown }> {
  const env = getAppEnv();
  const apiKey = env.googleGenerativeAiApiKey;
  if (!apiKey) {
    throw new Error("Brak GOOGLE_GENERATIVE_AI_API_KEY");
  }

  const modelId = env.geminiVisionModel;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: ROAD_ANALYSIS_SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema,
      // Keep outputs short — reduces timeout risk on Hobby (60s).
      maxOutputTokens: 2048,
    },
  });

  const inline = await toInlineImage(params.imageUrl);
  const prompt = buildRoadAnalysisUserPrompt({
    bbox: params.bbox,
    cloudCoverage: params.cloudCoverage,
    evalscriptId: params.evalscriptId,
    source: params.source,
  });

  // Single attempt — a blind retry often doubles latency into the 60s Vercel kill.
  const response = await model.generateContent(
    {
      contents: [
        {
          role: "user",
          parts: [
            // Image before text — Gemini vision best practice.
            {
              inlineData: {
                mimeType: inline.mimeType,
                data: inline.data,
              },
            },
            { text: prompt },
          ],
        },
      ],
    },
    { timeout: 50_000 },
  );

  const text = response.response.text();
  const json = extractJsonObject(text);
  const result = roadAnalysisResultSchema.parse(json);
  return { result, modelId, raw: result };
}
