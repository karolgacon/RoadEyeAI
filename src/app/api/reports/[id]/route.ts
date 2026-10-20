import { NextResponse } from "next/server";
import { getReportById } from "@/lib/db/reports";
import { findRoadById } from "@/lib/db/roads";
import { buildReportExportPayload } from "@/lib/pdf/reportTypes";
import type { ApiErrorBody } from "@/types/analysis";

export const dynamic = "force-dynamic";

function errorResponse(status: number, body: ApiErrorBody) {
  return NextResponse.json(body, { status });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) {
    return errorResponse(400, {
      code: "VALIDATION",
      message: "Report id is required",
    });
  }

  try {
    const report = await getReportById(id);
    if (!report) {
      return errorResponse(404, {
        code: "VALIDATION",
        message: `Report not found: ${id}`,
      });
    }

    const road = await findRoadById(report.roadId);
    const payload = buildReportExportPayload({
      reportId: report.id,
      roadId: report.roadId,
      scanId: report.scanId,
      modelId: report.modelId,
      createdAt: report.createdAt,
      result: report.result,
      road: road
        ? {
            ref: road.ref,
            name: road.name,
            roadClass: road.roadClass,
            osmId: road.osmId,
          }
        : undefined,
    });

    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(500, {
      code: "INTERNAL",
      message,
    });
  }
}
