function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  return value.trim();
}

function readBool(name: string, fallback: boolean): boolean {
  const value = readEnv(name);
  if (value === undefined) {
    return fallback;
  }
  return value === "true" || value === "1";
}

function readNumber(name: string, fallback: number): number {
  const value = readEnv(name);
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getSupabaseUrl(): string {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return url;
}

export function getSupabasePublishableKey(): string {
  const key =
    readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ??
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy ANON_KEY)",
    );
  }
  return key;
}

export function getSupabaseSecretKey(): string | undefined {
  return (
    readEnv("SUPABASE_SECRET_KEY") ?? readEnv("SUPABASE_SERVICE_ROLE_KEY")
  );
}

export function getAppEnv() {
  return {
    appUrl: readEnv("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
    appName: readEnv("NEXT_PUBLIC_APP_NAME") ?? "RoadEye AI",
    satelliteMockMode: readBool("SATELLITE_MOCK_MODE", true),
    aiProvider: readEnv("AI_PROVIDER") ?? "gemini",
    googleGenerativeAiApiKey: readEnv("GOOGLE_GENERATIVE_AI_API_KEY"),
    // gemini-2.0-flash is shut down; 3.8 Flash is current multimodal Flash.
    geminiVisionModel: readEnv("GEMINI_VISION_MODEL") ?? "gemini-3.8-flash",
    cloudCoverageThreshold: readNumber("CLOUD_COVERAGE_THRESHOLD", 0.2),
    databaseUrl: readEnv("DATABASE_URL"),
  };
}
