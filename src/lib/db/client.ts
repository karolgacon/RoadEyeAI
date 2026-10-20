import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabasePublishableKey,
  getSupabaseSecretKey,
  getSupabaseUrl,
} from "@/lib/utils/env";

let adminClient: SupabaseClient | null = null;
let browserClient: SupabaseClient | null = null;

export function createBrowserSupabaseClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }
  browserClient = createClient(getSupabaseUrl(), getSupabasePublishableKey());
  return browserClient;
}

export function createAdminSupabaseClient(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }
  const secret = getSupabaseSecretKey();
  if (!secret) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY)",
    );
  }
  adminClient = createClient(getSupabaseUrl(), secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return adminClient;
}

export async function pingSupabase(): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const client = createBrowserSupabaseClient();
    const { error } = await client.from("roads").select("id").limit(1);
    if (error) {
      if (
        error.message.includes("relation") ||
        error.code === "PGRST205" ||
        error.code === "42P01"
      ) {
        return {
          ok: true,
          message:
            "Supabase reachable; table roads not found yet (run migration)",
        };
      }
      return { ok: false, message: error.message };
    }
    return { ok: true, message: "Supabase reachable; roads table OK" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, message };
  }
}
