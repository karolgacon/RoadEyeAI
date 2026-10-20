import { NextResponse } from "next/server";
import { findRoadById } from "@/lib/db/roads";
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
    return NextResponse.json({ road });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(500, {
      code: "INTERNAL",
      message,
    });
  }
}
