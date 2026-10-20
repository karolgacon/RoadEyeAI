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
  if (imageUrl.startsWith("data:")) {
    return parseDataUrl(imageUrl);
  }
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Nie udało się pobrać obrazu do Vision (${response.status})`);
  }
  const mimeType = response.headers.get("content-type") ?? "image/png";
  const buffer = Buffer.from(await response.arrayBuffer());
  return { mimeType, data: buffer.toString("base64") };
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
    },
  });

  const inline = await toInlineImage(params.imageUrl);
  const prompt = buildRoadAnalysisUserPrompt({
    bbox: params.bbox,
    cloudCoverage: params.cloudCoverage,
    evalscriptId: params.evalscriptId,
    source: params.source,
  });

  const runOnce = async (): Promise<RoadAnalysisResult> => {
    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: inline.mimeType,
                data: inline.data,
              },
            },
          ],
        },
      ],
    });
    const text = response.response.text();
    const json = extractJsonObject(text);
    return roadAnalysisResultSchema.parse(json);
  };

  try {
    const result = await runOnce();
    return { result, modelId, raw: result };
  } catch (firstError) {
    // One repair attempt
    try {
      const result = await runOnce();
      return { result, modelId, raw: result };
    } catch {
      throw firstError instanceof Error
        ? firstError
        : new Error("Walidacja odpowiedzi Gemini nie powiodła się");
    }
  }
}
