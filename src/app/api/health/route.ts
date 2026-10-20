import { NextResponse } from "next/server";
import { pingSupabase } from "@/lib/db/client";
import { getAppEnv } from "@/lib/utils/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getAppEnv();
  let supabaseStatus: { ok: boolean; message: string };

  try {
    supabaseStatus = await pingSupabase();
  } catch (error) {
    supabaseStatus = {
      ok: false,
      message: error instanceof Error ? error.message : "Supabase ping failed",
    };
  }

  const healthy = supabaseStatus.ok;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      app: env.appName,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
      region: process.env.VERCEL_REGION ?? "local",
      satelliteMockMode: env.satelliteMockMode,
      aiProvider: env.aiProvider,
      geminiConfigured: Boolean(env.googleGenerativeAiApiKey),
      databaseUrlConfigured: Boolean(env.databaseUrl),
      supabase: supabaseStatus,
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
