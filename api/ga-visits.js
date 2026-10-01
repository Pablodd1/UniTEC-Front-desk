// GET /api/ga-visits
// Trae las VISITAS REALES de Google Analytics 4 y las guarda en config/main.googleAnalyticsVisits
// (el campo que leen el panel Mission Control y el informe diario). Antes ese KPI mostraba un
// número fijo del código (3.188) porque nadie lo actualizaba.
//
// Configuración (Vercel → Environment Variables, Production):
//   GA4_PROPERTY_ID        = 123456789  (Admin → Configuración de la propiedad en GA4; NO es el G-XXXX)
//   GA_SERVICE_ACCOUNT_JSON = { ...JSON de la cuenta de servicio... }  (o base64 del JSON)
//   La cuenta de servicio debe tener acceso de LECTURA a la propiedad en GA4
//   (GA4 → Administrar → Acceso a la propiedad → añadir el email de la cuenta de servicio).
//
// Sin esas variables responde { configured:false } y NO inventa cifras: el panel muestra "sin dato".
// Es idempotente y barato: se puede llamar por cron o a mano (?days=30).

import crypto from 'node:crypto';
import { createRequire } from 'module';
const require_ = createRequire(import.meta.url);
const firebaseConfig = require_('../firebase-applet-config.json');

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64(header)}.${b64(payload)}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(serviceAccount.private_key);
  const assertion = `${unsigned}.${signature.toString('base64url')}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.access_token;
}

async function runReport(accessToken, propertyId, startDate, endDate) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }],
    }),
  });
  if (!res.ok) throw new Error(`runReport ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const row = data.rows?.[0]?.metricValues || [];
  return {
    sessions: parseInt(row[0]?.value || '0', 10),
    totalUsers: parseInt(row[1]?.value || '0', 10),
    pageViews: parseInt(row[2]?.value || '0', 10),
  };
}

async function saveToConfig(idToken, projectId, visits, detail) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/config/main`
    + '?updateMask.fieldPaths=googleAnalyticsVisits&updateMask.fieldPaths.googleAnalyticsUpdatedAt&updateMask.fieldPaths.googleAnalyticsDetail';
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        googleAnalyticsVisits: { stringValue: String(visits) },
        googleAnalyticsUpdatedAt: { stringValue: new Date().toISOString() },
        googleAnalyticsDetail: { stringValue: JSON.stringify(detail).slice(0, 500) },
      },
    }),
  });
  return res.ok;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const propertyId = process.env.GA4_PROPERTY_ID || '';
  let saJson = process.env.GA_SERVICE_ACCOUNT_JSON || '';

  if (!propertyId || !saJson) {
    return res.status(200).json({
      configured: false,
      hint: 'Faltan GA4_PROPERTY_ID y/o GA_SERVICE_ACCOUNT_JSON en las variables de entorno de Vercel. '
        + 'Mientras no existan, el panel muestra "sin dato" en lugar del número fijo 3.188.',
    });
  }

  try {
    // Acepta el JSON en texto o en base64 (pegar JSON con saltos de línea en Vercel es frágil)
    if (!saJson.trim().startsWith('{')) {
      saJson = Buffer.from(saJson, 'base64').toString('utf-8');
    }
    const serviceAccount = JSON.parse(saJson);

    const days = Math.max(1, Math.min(365, parseInt(String(req.query?.days || '30'), 10) || 30));
    const endDate = String(req.query?.to || 'today');
    const startDate = String(req.query?.from || `${days}daysAgo`);

    const accessToken = await getAccessToken(serviceAccount);
    const report = await runReport(accessToken, propertyId, startDate, endDate);

    // Guardar en config/main para que TODAS las superficies lean el mismo número
    const { getFirestoreToken, projectId } = await import('./_analytics-core.js');
    const idToken = await getFirestoreToken();
    const saved = idToken ? await saveToConfig(idToken, projectId, report.sessions, { from: startDate, to: endDate, ...report }) : false;

    return res.status(200).json({
      configured: true,
      propertyId,
      range: { startDate, endDate },
      ...report,
      savedToConfig: saved,
    });
  } catch (e) {
    console.error('ga-visits error:', e);
    return res.status(502).json({ configured: true, error: String(e?.message || e) });
  }
}
