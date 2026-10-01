// /api/warm — keep-alive endpoint. Pinged every 5 min by Vercel Cron
// (see vercel.json) so the serverless function never fully sleeps, which
// eliminates the 10-20s cold-start "not responding" window for the first
// visitor after idle. Does NOT call any AI provider (zero quota cost) —
// it only warms the function instance + the cached Firebase auth token
// used by /api/chat's server-side session recording.

import { createRequire } from 'module';
const require_ = createRequire(import.meta.url);
const firebaseConfig = require_('../firebase-applet-config.json');

let cachedIdToken = { token: '', exp: 0 };

async function getFirestoreToken() {
  if (cachedIdToken.token && Date.now() < cachedIdToken.exp) return cachedIdToken.token;
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!authRes.ok) return null;
  const data = await authRes.json();
  cachedIdToken = { token: data.idToken, exp: Date.now() + (parseInt(data.expiresIn || '3600', 10) - 300) * 1000 };
  return data.idToken;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const token = await getFirestoreToken();
    return res.status(200).json({
      ok: true,
      warm: true,
      firebaseAuth: !!token,
      ts: new Date().toISOString()
    });
  } catch (e) {
    // Warm endpoint must never error loudly — it's a keep-alive, not a feature.
    return res.status(200).json({ ok: true, warm: true, firebaseAuth: false, note: e.message });
  }
}
