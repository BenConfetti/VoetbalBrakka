import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';

const schemaSql = `CREATE TABLE IF NOT EXISTS app_states (
  user_id TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
)`;

async function userId() {
  const user = await getChatGPTUser();
  if (user) return user.userId;
  if (process.env.NODE_ENV === 'development') return 'local-preview';
  return null;
}

async function ensureSchema() {
  await env.DB.prepare(schemaSql).run();
}

export async function GET() {
  const id = await userId();
  if (!id) return Response.json({ error: 'Niet ingelogd' }, { status: 401 });
  await ensureSchema();
  const row = await env.DB.prepare('SELECT state_json, revision, updated_at FROM app_states WHERE user_id = ?').bind(id).first<{ state_json: string; revision: number; updated_at: string }>();
  return Response.json(row ? { state: JSON.parse(row.state_json), revision: row.revision, updatedAt: row.updated_at } : { state: null, revision: 0 });
}

export async function PUT(request: Request) {
  const id = await userId();
  if (!id) return Response.json({ error: 'Niet ingelogd' }, { status: 401 });
  const body = await request.json() as { state?: unknown };
  if (!body.state) return Response.json({ error: 'Geen gegevens ontvangen' }, { status: 400 });
  await ensureSchema();
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO app_states (user_id, state_json, revision, updated_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, revision = revision + 1, updated_at = excluded.updated_at`)
    .bind(id, JSON.stringify(body.state), now).run();
  const row = await env.DB.prepare('SELECT revision FROM app_states WHERE user_id = ?').bind(id).first<{ revision: number }>();
  return Response.json({ ok: true, revision: row?.revision ?? 1, updatedAt: now });
}
