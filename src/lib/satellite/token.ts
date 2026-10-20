import {
  RateLimitError,
  SatelliteConfigError,
  SatelliteError,
} from "@/lib/satellite/errors";

type CachedToken = { value: string; expiresAtMs: number };

let cached: CachedToken | null = null;

function readRequired(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new SatelliteConfigError(`Brak zmiennej środowiskowej ${name}`);
  }
  return value;
}

export function hasCopernicusCredentials(): boolean {
  return Boolean(
    process.env.COPERNICUS_CLIENT_ID?.trim() &&
      process.env.COPERNICUS_CLIENT_SECRET?.trim(),
  );
}

/** Cached CDSE OAuth token (reused across Process API + basemap tiles). */
export async function getCopernicusAccessToken(): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAtMs > now + 30_000) {
    return cached.value;
  }

  const clientId = readRequired("COPERNICUS_CLIENT_ID");
  const clientSecret = readRequired("COPERNICUS_CLIENT_SECRET");
  const tokenUrl =
    process.env.COPERNICUS_TOKEN_URL?.trim() ||
    "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (response.status === 429) {
    throw new RateLimitError();
  }
  if (!response.ok) {
    throw new SatelliteError(
      "UPSTREAM",
      `OAuth Copernicus nie powiódł się (${response.status})`,
    );
  }

  const json = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) {
    throw new SatelliteConfigError("Brak access_token w odpowiedzi Copernicus");
  }

  const ttlSec = Math.max(60, (json.expires_in ?? 3600) - 60);
  cached = {
    value: json.access_token,
    expiresAtMs: now + ttlSec * 1000,
  };
  return json.access_token;
}
