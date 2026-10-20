import pg from "pg";

let pool: pg.Pool | null = null;

function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export function getPgPool(): pg.Pool {
  if (pool) {
    return pool;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL");
  }

  // On Vercel Hobby prefer Session/Transaction pooler URL (port 6543).
  pool = new pg.Pool({
    connectionString,
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
