import { randomUUID } from "node:crypto";
import { getPgPool } from "@/lib/db/pg";
import type { RoadAnalysisResult } from "@/types/analysis";

export interface AnalysisReportRecord {
  id: string;
  roadId: string;
  scanId: string;
  result: RoadAnalysisResult;
  modelId: string;
  createdAt: string;
}

export async function saveAnalysisReport(params: {
  roadId: string;
  scanId: string;
  result: RoadAnalysisResult;
  modelId: string;
  raw: unknown;
}): Promise<AnalysisReportRecord> {
  const pool = getPgPool();
  const id = randomUUID();

  await pool.query("BEGIN");
  try {
    await pool.query(
      `
      INSERT INTO analysis_reports (
        id, road_id, scan_id, pci_score, surface_defects,
        condition_description, probable_causes, recommendations,
        potential_hazards, confidence_score, model_id, raw_response
      )
      VALUES (
        $1,$2,$3,$4,$5::jsonb,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12::jsonb
      )
      `,
      [
        id,
        params.roadId,
        params.scanId,
        params.result.pciScore,
        JSON.stringify(params.result.surfaceDefects),
        params.result.conditionDescription,
        JSON.stringify(params.result.probableCauses),
        JSON.stringify(params.result.recommendations),
        JSON.stringify(params.result.potentialHazards),
        params.result.confidenceScore,
        params.modelId,
        JSON.stringify(params.raw ?? null),
      ],
    );

    await pool.query(
      `
      UPDATE roads
      SET latest_pci = $2,
          latest_analyzed_at = now(),
          updated_at = now()
      WHERE id = $1
      `,
      [params.roadId, params.result.pciScore],
    );

    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }

  return {
    id,
    roadId: params.roadId,
    scanId: params.scanId,
    result: params.result,
    modelId: params.modelId,
    createdAt: new Date().toISOString(),
  };
}

interface ReportRow {
  id: string;
  road_id: string;
  scan_id: string;
  pci_score: number;
  surface_defects: RoadAnalysisResult["surfaceDefects"] | string;
  condition_description: string;
  probable_causes: string[] | string;
  recommendations: string[] | string;
  potential_hazards: string[] | string;
  confidence_score: number;
  model_id: string;
  created_at: Date | string;
}

function parseJsonArray<T>(value: T[] | string): T[] {
  if (typeof value === "string") {
    return JSON.parse(value) as T[];
  }
  return value;
}

function mapReportRow(row: ReportRow): AnalysisReportRecord {
  const createdAt =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString();

  return {
    id: row.id,
    roadId: row.road_id,
    scanId: row.scan_id,
    modelId: row.model_id,
    createdAt,
    result: {
      pciScore: row.pci_score as RoadAnalysisResult["pciScore"],
      surfaceDefects: parseJsonArray(row.surface_defects),
      conditionDescription: row.condition_description,
      probableCauses: parseJsonArray(row.probable_causes),
      recommendations: parseJsonArray(row.recommendations),
      potentialHazards: parseJsonArray(row.potential_hazards),
      confidenceScore: row.confidence_score,
    },
  };
}

export async function getLatestReportForRoad(
  roadId: string,
): Promise<AnalysisReportRecord | null> {
  const pool = getPgPool();
  const result = await pool.query<ReportRow>(
    `
    SELECT *
    FROM analysis_reports
    WHERE road_id = $1
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [roadId],
  );

  const row = result.rows[0];
  return row ? mapReportRow(row) : null;
}

export async function getReportById(
  id: string,
): Promise<AnalysisReportRecord | null> {
  const pool = getPgPool();
  const result = await pool.query<ReportRow>(
    `
    SELECT *
    FROM analysis_reports
    WHERE id = $1
    LIMIT 1
    `,
    [id],
  );
  const row = result.rows[0];
  return row ? mapReportRow(row) : null;
}
