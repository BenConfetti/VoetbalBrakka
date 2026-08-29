import { Pool } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const globalPool = globalThis as typeof globalThis & { footballPool?: Pool };
const pool = globalPool.footballPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});
if (process.env.NODE_ENV !== 'production') globalPool.footballPool = pool;

const schemaSql = `CREATE TABLE IF NOT EXISTS app_states (
  user_id TEXT PRIMARY KEY,
  state_json JSONB NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

function userId(request: Request) { return request.headers.get('x-app-user') ?? 'coach'; }
async function ensureSchema() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL ontbreekt');
  await pool.query(schemaSql);
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const result = await pool.query('SELECT state_json, revision, updated_at FROM app_states WHERE user_id = $1', [userId(request)]);
    const row = result.rows[0];
    return Response.json(row ? { state: row.state_json, revision: row.revision, updatedAt: row.updated_at } : { state: null, revision: 0 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Database niet beschikbaar' }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { state?: unknown };
    if (!body.state) return Response.json({ error: 'Geen gegevens ontvangen' }, { status: 400 });
    await ensureSchema();
    const result = await pool.query(`INSERT INTO app_states (user_id, state_json, revision, updated_at)
      VALUES ($1, $2::jsonb, 1, NOW())
      ON CONFLICT(user_id) DO UPDATE SET state_json = EXCLUDED.state_json, revision = app_states.revision + 1, updated_at = NOW()
      RETURNING revision, updated_at`, [userId(request), JSON.stringify(body.state)]);
    return Response.json({ ok: true, revision: result.rows[0].revision, updatedAt: result.rows[0].updated_at });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Opslaan mislukt' }, { status: 503 });
  }
}
