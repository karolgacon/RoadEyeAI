import { NextResponse } from "next/server";
import type { ApiErrorBody } from "@/types/analysis";

export function errorResponse(status: number, body: ApiErrorBody) {
  return NextResponse.json(body, { status });
}

export function rateLimitedResponse(retryAfterSec: number) {
  return NextResponse.json(
    {
      code: "RATE_LIMIT" as const,
      message: `Zbyt wiele żądań. Spróbuj za ${retryAfterSec}s.`,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
      },
    },
  );
}
