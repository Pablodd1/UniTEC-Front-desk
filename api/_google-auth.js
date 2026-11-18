// api/_google-auth.js — token de servicio (OAuth) para hablar con Firestore SIN pasar por las reglas.
//
// Por qué: /api/disposition-types (tipificación) usa la colección `disposition_types`, que no está
// en las reglas públicas → con el token anónimo de Firebase devolvía 403 ("listTypes 403") y el
// selector del asesor quedaba vacío en producción.
//
// La cuenta de servicio (GA_SERVICE_ACCOUNT_JSON, la misma del Admin SDK de Firebase) tiene rol de
// IAM sobre el proyecto, y las reglas de Firestore NO aplican a cuentas de servicio: con este token
// las lecturas/escrituras funcionan sin abrir la colección al público.
//
// Sin credenciales devuelve null y el llamador decide el respaldo (nunca lanza en import).

import crypto from 'node:crypto';

let cache = { token: '', expiresAt: 0 };

function serviceAccount() {
  let raw = process.env.GA_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
  if (!raw) return null;
  if (!raw.trim().startsWith('{')) {
    try { raw = Buffer.from(raw, 'base64').toString('utf-8'); } catch { return null; }
  }
  try {
    const sa = JSON.parse(raw);
    return sa.client_email && sa.private_key ? sa : null;
  } catch {
    return null;
  }
}

export function hasServiceAccount() {
  return !!serviceAccount();
}

export async function getGoogleAccessToken(scope = 'https://www.googleapis.com/auth/datastore') {
  const sa = serviceAccount();
  if (!sa) return null;
  if (cache.token && Date.now() < cache.expiresAt) return cache.token;

  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64(header)}.${b64(payload)}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key);
  const assertion = `${unsigned}.${signature.toString('base64url')}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    console.warn('[google-auth] token request failed:', res.status, (await res.text()).slice(0, 160));
    return null;
  }
  const data = await res.json();
  cache = { token: data.access_token, expiresAt: Date.now() + (Number(data.expires_in || 3600) - 120) * 1000 };
  return cache.token;
}

export default getGoogleAccessToken;
