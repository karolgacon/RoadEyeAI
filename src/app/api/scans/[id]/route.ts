import { NextResponse } from "next/server";
import { getSatelliteScanById } from "@/lib/db/scans";
import { errorResponse } from "@/lib/http/apiErrors";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) {
    return errorResponse(400, {
      code: "VALIDATION",
      message: "Scan id is required",
    });
  }

  try {
    const scan = await getSatelliteScanById(id);
    if (!scan) {
      return errorResponse(404, {
        code: "NO_SCENE",
        message: `Scan not found: ${id}`,
      });
    }
    return NextResponse.json({ ok: true, scan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(500, {
      code: "INTERNAL",
      message,
    });
  }
}
