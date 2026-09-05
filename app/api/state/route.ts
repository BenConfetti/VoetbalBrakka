import { Pool,PoolClient } from 'pg';

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
const versionsSchemaSql = `CREATE TABLE IF NOT EXISTS app_state_versions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  state_json JSONB NOT NULL,
  revision INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

// Authentication controls who may open the app, but all authorised coaches
// work with the same team administration. Keep that data identity deliberately
// separate from APP_USERNAME, so changing or adding a login cannot hide data.
const sharedStateId = '__shared_team__';

async function ensureSchema() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL ontbreekt');
  await pool.query(schemaSql);
  await pool.query(versionsSchemaSql);
}

async function ensureSharedState() {
  // One-time migration for installations that stored state under APP_USERNAME.
  // APP_LEGACY_USERNAME can identify the desired source explicitly. Without it,
  // the most recently updated legacy state is the safest automatic candidate.
  await pool.query(`INSERT INTO app_states (user_id, state_json, revision, updated_at)
    SELECT $1, state_json, revision, updated_at
    FROM app_states
    WHERE user_id <> $1
    ORDER BY CASE WHEN user_id = $2 THEN 0 ELSE 1 END, updated_at DESC
    LIMIT 1
    ON CONFLICT(user_id) DO NOTHING`, [sharedStateId, process.env.APP_LEGACY_USERNAME ?? null]);
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    await ensureSharedState();
    if (new URL(request.url).searchParams.has('versions')) {
      const [current, versions] = await Promise.all([
        pool.query('SELECT revision, updated_at FROM app_states WHERE user_id = $1', [sharedStateId]),
        pool.query(`SELECT id, revision, created_at FROM app_state_versions
          WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 5`, [sharedStateId]),
      ]);
      return Response.json({
        current: current.rows[0] ? { revision: current.rows[0].revision, createdAt: current.rows[0].updated_at } : null,
        versions: versions.rows.map(row => ({ id: String(row.id),revision: row.revision,createdAt: row.created_at })),
      });
    }
    const result = await pool.query('SELECT state_json, revision, updated_at FROM app_states WHERE user_id = $1', [sharedStateId]);
    const row = result.rows[0];
    return Response.json(row ? { state: row.state_json, revision: row.revision, updatedAt: row.updated_at } : { state: null, revision: 0 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Database niet beschikbaar' }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  let client: PoolClient|undefined;
  try {
    const body = await request.json() as { state?: unknown };
    if (!body.state) return Response.json({ error: 'Geen gegevens ontvangen' }, { status: 400 });
    await ensureSchema();
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT revision FROM app_states WHERE user_id = $1 FOR UPDATE', [sharedStateId]);
    await client.query(`INSERT INTO app_state_versions (user_id, state_json, revision, created_at)
      SELECT user_id, state_json, revision, updated_at FROM app_states
      WHERE user_id = $1 AND state_json IS DISTINCT FROM $2::jsonb`, [sharedStateId, JSON.stringify(body.state)]);
    const result = await client.query(`INSERT INTO app_states (user_id, state_json, revision, updated_at)
      VALUES ($1, $2::jsonb, 1, NOW())
      ON CONFLICT(user_id) DO UPDATE SET state_json = EXCLUDED.state_json, revision = app_states.revision + 1, updated_at = NOW()
      RETURNING revision, updated_at`, [sharedStateId, JSON.stringify(body.state)]);
    await client.query(`DELETE FROM app_state_versions WHERE user_id = $1 AND id NOT IN
      (SELECT id FROM app_state_versions WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 5)`, [sharedStateId]);
    await client.query('COMMIT');
    return Response.json({ ok: true, revision: result.rows[0].revision, updatedAt: result.rows[0].updated_at });
  } catch (error) {
    await client?.query('ROLLBACK').catch(() => undefined);
    console.error(error);
    return Response.json({ error: 'Opslaan mislukt' }, { status: 503 });
  } finally {
    client?.release();
  }
}

export async function POST(request: Request) {
  let client: PoolClient|undefined;
  try {
    const body = await request.json() as { versionId?: string };
    if (!body.versionId || !/^\d+$/.test(body.versionId)) return Response.json({ error: 'Ongeldige versie' }, { status: 400 });
    await ensureSchema();
    await ensureSharedState();
    client = await pool.connect();
    await client.query('BEGIN');
    const current = await client.query('SELECT state_json, revision FROM app_states WHERE user_id = $1 FOR UPDATE', [sharedStateId]);
    const target = await client.query('SELECT state_json FROM app_state_versions WHERE user_id = $1 AND id = $2', [sharedStateId, body.versionId]);
    if (!current.rows[0] || !target.rows[0]) {
      await client.query('ROLLBACK');
      return Response.json({ error: 'Versie niet gevonden' }, { status: 404 });
    }
    await client.query(`INSERT INTO app_state_versions (user_id, state_json, revision, created_at)
      VALUES ($1, $2::jsonb, $3, NOW())`, [sharedStateId, JSON.stringify(current.rows[0].state_json), current.rows[0].revision]);
    const restored = await client.query(`UPDATE app_states SET state_json = $2::jsonb,
      revision = revision + 1, updated_at = NOW() WHERE user_id = $1
      RETURNING state_json, revision, updated_at`, [sharedStateId, JSON.stringify(target.rows[0].state_json)]);
    await client.query(`DELETE FROM app_state_versions WHERE user_id = $1 AND id NOT IN
      (SELECT id FROM app_state_versions WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 5)`, [sharedStateId]);
    await client.query('COMMIT');
    const row = restored.rows[0];
    return Response.json({ state: row.state_json,revision: row.revision,updatedAt: row.updated_at });
  } catch (error) {
    await client?.query('ROLLBACK').catch(() => undefined);
    console.error(error);
    return Response.json({ error: 'Terugzetten mislukt' }, { status: 503 });
  } finally {
    client?.release();
  }
}
