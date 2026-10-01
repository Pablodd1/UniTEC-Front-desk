import { createRequire } from 'module';

const require_ = createRequire(import.meta.url);
const firebaseConfig = require_('../firebase-applet-config.json');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    });
    if (!authRes.ok) {
      return res.status(200).json({ ok: false, latest: null, error: 'auth' });
    }
    const { idToken } = await authRes.json();
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/config/main`;
    const docRes = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
    if (!docRes.ok) return res.status(200).json({ ok: true, latest: null });
    const doc = await docRes.json();
    const raw = doc?.fields?.recentAnomaly?.stringValue || '';
    const at = doc?.fields?.recentAnomalyAt?.stringValue || '';
    let latest = null;
    if (raw) {
      try { latest = JSON.parse(raw); } catch { latest = { detail: raw, at }; }
    }
    return res.status(200).json({ ok: true, latest, at: latest?.at || at || null });
  } catch (e) {
    return res.status(200).json({ ok: false, latest: null, error: 'read_failed' });
  }
}
