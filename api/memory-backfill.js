// GET /api/memory-backfill?limit=40&dryRun=true
//
// Fixes the "chats are missing from Memoria" gap: only ~83 of 5.1k conversations had an archive,
// because the sweep only ran when somebody pressed the button in the panel.
//
// Per run it takes up to `limit` finished conversations that have no archive, reads their messages,
// writes conversation_archives/archive_<id> and marks the conversation isArchived + summary.
// Idempotent: an existing archive is skipped. Never deletes messages.
//
// Auth: Vercel cron (user-agent) or `?key=<SWEEP_KEY>` when SWEEP_KEY is configured.
import { getFirestoreToken, listAllSessions, isTestSession, projectId } from './_analytics-core.js';

const DOCS = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const DONE = /^(completed|resolved|abandoned)/;

async function readMessages(token, sessionId) {
  const out = [];
  let pageToken = null;
  for (let page = 0; page < 4; page++) {
    const url = `${DOCS}/conversations/${sessionId}/messages?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) break;
    const j = await r.json();
    for (const d of j.documents || []) {
      const f = d.fields || {};
      out.push({
        role: f.role?.stringValue || 'user',
        text: f.text?.stringValue || '',
        timestamp: f.timestamp?.stringValue || '',
      });
    }
    pageToken = j.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

async function archiveExists(token, sessionId) {
  const r = await fetch(`${DOCS}/conversation_archives/archive_${sessionId}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(6000),
  });
  return r.ok;
}

function fallbackSummary(session, messages) {
  const topics = Array.isArray(session.topics) && session.topics.length ? session.topics.join(', ') : 'consulta general';
  const human = ['human_requested', 'human_assigned'].includes(String(session.status || ''));
  return `Conversación de ${messages.length} mensajes sobre ${topics}. ${human ? 'El cliente solicitó atención humana.' : 'Atendida por IA.'} Estado final: ${session.status || 'sin estado'}.`;
}

async function aiSummary(session, messages) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !messages.length) return null;
  const transcript = messages.slice(-30).map((m) => `${m.role === 'user' ? 'Cliente' : m.role === 'staff' ? 'Asesor' : 'Bot'}: ${String(m.text).slice(0, 400)}`).join('\n');
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Resume esta conversación de atención al cliente en 2 frases y extrae hasta 5 pares pregunta/respuesta útiles para entrenar al bot. Devuelve SOLO JSON: {"summary":"...","qa":[{"q":"...","a":"..."}]}.\n\n${transcript}` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 700, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const raw = j?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    if (!parsed?.summary) return null;
    const qa = Array.isArray(parsed.qa) ? parsed.qa.filter((x) => x && x.q && x.a).slice(0, 5).map((x) => ({ question: String(x.q).slice(0, 220), answer: String(x.a).slice(0, 400) })) : [];
    return { summary: String(parsed.summary).slice(0, 600), qa };
  } catch {
    return null;
  }
}

async function patch(token, path, fields, masks) {
  const qs = (masks || Object.keys(fields)).map((m) => `updateMask.fieldPaths=${encodeURIComponent(m)}`).join('&');
  const r = await fetch(`${DOCS}/${path}?${qs}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
    signal: AbortSignal.timeout(8000),
  });
  return r.ok;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const sweepKey = process.env.SWEEP_KEY || '';
  const ua = String(req.headers['user-agent'] || '');
  const authorized = !sweepKey || req.headers['x-sweep-key'] === sweepKey || req.query?.key === sweepKey || /vercel-cron/i.test(ua);
  if (!authorized) return res.status(401).json({ error: 'unauthorized' });

  const dryRun = String(req.query?.dryRun || '') === 'true';
  const limit = Math.min(120, Math.max(1, Number(req.query?.limit) || 40));

  const started = Date.now();
  try {
    const token = await getFirestoreToken();
    if (!token) return res.status(503).json({ error: 'auth_unavailable' });

    const sessions = await listAllSessions(token);
    const candidates = sessions
      .filter((s) => s && s.id && !isTestSession(s.id))
      .filter((s) => DONE.test(String(s.status || '')))
      .sort((a, b) => String(b.lastUpdated || '').localeCompare(String(a.lastUpdated || '')))
      .slice(0, limit * 3);

    let archived = 0;
    let skipped = 0;
    let failed = 0;
    let withQa = 0;

    for (const s of candidates) {
      if (archived + failed >= limit) break;
      try {
        if (s.isArchived === true) {
          skipped++;
          continue;
        }
        if (await archiveExists(token, s.id)) {
          skipped++;
          continue;
        }
        const messages = await readMessages(token, s.id);
        if (!messages.length) {
          skipped++;
          continue;
        }
        const ai = await aiSummary(s, messages);
        const summary = ai?.summary || fallbackSummary(s, messages);
        if (ai?.qa?.length) withQa++;

        if (dryRun) {
          archived++;
          continue;
        }

        const archive = {
          id: { stringValue: `archive_${s.id}` },
          originalSessionId: { stringValue: s.id },
          brandId: { stringValue: s.brandId || 'unitec' },
          language: { stringValue: s.language || 'es' },
          summary: { stringValue: summary },
          messageCount: { integerValue: String(messages.length) },
          status: { stringValue: String(s.status || '') },
          createdAt: { stringValue: s.createdAt || '' },
          endedAt: { stringValue: s.lastUpdated || '' },
          archivedAt: { stringValue: new Date().toISOString() },
          source: { stringValue: s.source || 'web' },
          topics: { arrayValue: { values: (Array.isArray(s.topics) ? s.topics.slice(0, 8) : []).map((t) => ({ stringValue: String(t) })) } },
        };
        if (ai?.qa?.length) {
          archive.qaPairs = {
            arrayValue: {
              values: ai.qa.map((x) => ({
                mapValue: { fields: { question: { stringValue: x.question }, answer: { stringValue: x.answer } } },
              })),
            },
          };
        }

        const ok = await patch(token, `conversation_archives/archive_${s.id}`, archive, Object.keys(archive));
        if (!ok) {
          failed++;
          continue;
        }
        await patch(
          token,
          `conversations/${s.id}`,
          {
            isArchived: { booleanValue: true },
            summary: { stringValue: summary },
            summaryGeneratedAt: { stringValue: new Date().toISOString() },
          },
          ['isArchived', 'summary', 'summaryGeneratedAt'],
        );
        archived++;
      } catch (e) {
        failed++;
        console.error('[memory-backfill]', s.id, e?.message || e);
      }
    }

    return res.status(200).json({
      ok: true,
      dryRun,
      scanned: sessions.length,
      candidates: candidates.length,
      archived,
      skipped,
      failed,
      withQa,
      ms: Date.now() - started,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
