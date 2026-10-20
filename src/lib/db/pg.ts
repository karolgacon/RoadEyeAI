import pg from "pg";

let pool: pg.Pool | null = null;

function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/** Strip sslmode from URL — we set SSL explicitly for Supabase pooler on Vercel. */
function normalizeConnectionString(raw: string): string {
  try {
    const url = new URL(raw);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("ssl");
    return url.toString();
  } catch {
    return raw;
  }
}

export function getPgPool(): pg.Pool {
  if (pool) {
    return pool;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL");
  }

  // Prefer Supabase pooler (port 6543) on Vercel — direct db.* is often IPv6-only.
  pool = new pg.Pool({
    connectionString: normalizeConnectionString(connectionString),
    ssl: { rejectUnauthorized: false },
    max: isServerless() ? 1 : 4,
    idleTimeoutMillis: isServerless() ? 8_000 : 30_000,
    connectionTimeoutMillis: 12_000,
    allowExitOnIdle: isServerless(),
  });

  pool.on("error", (err) => {
    console.error("[pg] idle client error", err.message);
  });

  return pool;
}
