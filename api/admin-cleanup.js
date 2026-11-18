// POST /api/admin-cleanup — borra SOLO documentos de PRUEBA (nunca datos de clientes).
//
// Por qué existe: las sondas de verificación (diag-*, probe_*, lat-test…) dejan sesiones y avisos
// en Firestore que aparecen en BANDEJA/ALERTAS y ensucian los números. Con el token anónimo del
// panel no se pueden borrar (reglas), así que hace falta la cuenta de servicio.
//
// Seguridad:
//   · Requiere `Authorization: Bearer <ADMIN_SECRET>` (mismo secreto que /api/gemini-key).
//   · Sólo toca ids que empiecen por los prefijos de prueba de abajo; cualquier otro id se ignora.
//   · `dryRun` es el valor por defecto: hay que pedir `{"dryRun":false}` explícitamente.
//   · Nunca borra `test-monitor-*` (son el autotest del bot, no basura).
import { getGoogleAccessToken } from './_google-auth.js';

const TEST_ID = /^(diag-|analytics-verify|secret-verify|probe[-_]|lat-test|sweep-|review-|plan-)/i;
const KEEP = /^test-monitor/i;

export const config = { maxDuration: 60 };

function authorized(req) {
  const secret = process.env.ADMIN_SECRET || '';
  if (!secret) return false;
  const h = String(req.headers.authorization || '');
  const bearer = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  const q = String(req.query?.key || '');
  return bearer === secret || q === secret;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  if (!authorized(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const token = await getGoogleAccessToken();
  if (!token) return res.status(503).json({ ok: false, error: 'service_account_missing' });

  const project = process.env.FIREBASE_PROJECT_ID || 'chatbot-bi-front-desk';
  const B = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  const H = { Authorization: `Bearer ${token}` };
  const dryRun = req.body?.dryRun !== false; // por defecto simula
  const collections = Array.isArray(req.body?.collections) ? req.body.collections : ['conversations', 'escalations'];
  const idFields = { conversations: ['id'], escalations: ['sessionId'] };

  const report = { dryRun, collections: {}, deleted: { conversations: 0, escalations: 0, messages: 0 }, errors: [] };

  const list = async (collection) => {
    const out = [];
    let pageToken = '';
    do {
      const r = await fetch(`${B}/${collection}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`, { headers: H, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`list ${collection} ${r.status}`);
      const d = await r.json();
      out.push(...(d.documents || []));
      pageToken = d.nextPageToken || '';
    } while (pageToken);
    return out;
  };

  const del = async (name) => {
    const r = await fetch(`https://firestore.googleapis.com/v1/${name}`, { method: 'DELETE', headers: H, signal: AbortSignal.timeout(20000) });
    return r.ok;
  };

  for (const collection of collections) {
    const fields = idFields[collection] || ['id'];
    try {
      const docs = await list(collection);
      const targets = docs.filter((d) => {
        const docId = String(d.name || '').split('/').pop();
        const values = fields.map((f) => d.fields?.[f]?.stringValue || '').filter(Boolean);
        const any = [docId, ...values].some((v) => TEST_ID.test(v) && !KEEP.test(v));
        return any;
      });
      report.collections[collection] = { scanned: docs.length, matched: targets.length };
      if (!dryRun) {
        for (const d of targets) {
          const docId = String(d.name || '').split('/').pop();
          if (collection === 'conversations') {
            const mr = await fetch(`${B}/conversations/${docId}/messages?pageSize=300`, { headers: H, signal: AbortSignal.timeout(20000) });
            if (mr.ok) {
              const mj = await mr.json();
              for (const m of mj.documents || []) {
                if (await del(m.name)) report.deleted.messages += 1;
              }
            }
          }
          if (await del(d.name)) report.deleted[collection] = (report.deleted[collection] || 0) + 1;
        }
      }
    } catch (e) {
      report.errors.push(`${collection}: ${e.message}`);
    }
  }

  return res.status(200).json({ ok: report.errors.length === 0, ...report });
}
