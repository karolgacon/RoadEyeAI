import { NextResponse } from "next/server";
import { getLatestReportForRoad } from "@/lib/db/reports";
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
      message: "Road id is required",
    });
  }

  try {
    const road = await findRoadById(id);
    if (!road) {
      return errorResponse(404, {
        code: "VALIDATION",
        message: `Road not found: ${id}`,
      });
    }

    const report = await getLatestReportForRoad(id);
    if (!report) {
      return errorResponse(404, {
        code: "VALIDATION",
        message: "Brak raportu analizy dla tego odcinka",
      });
    }

    const payload = buildReportExportPayload({
      reportId: report.id,
      roadId: report.roadId,
      scanId: report.scanId,
      modelId: report.modelId,
      createdAt: report.createdAt,
      result: report.result,
      road: {
        ref: road.ref,
        name: road.name,
        roadClass: road.roadClass,
        osmId: road.osmId,
      },
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
