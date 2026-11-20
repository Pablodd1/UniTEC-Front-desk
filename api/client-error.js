// Registro de errores de render del panel.
//
// El asesor veía una pantalla en blanco sin ninguna pista cuando un componente fallaba. El boundary
// del cliente manda el error aquí para poder diagnosticarlo después (qué mensaje, qué pila, qué URL).
//
// Seguridad: sin datos clínicos ni credenciales; se trunca todo; si el almacenamiento falla se
// responde 204 igualmente (el fallo del cliente no debe romper la UI).

import { getGoogleAccessToken } from './_google-auth.js';
import { addDoc } from './_firestore-rest.js';

const MAX_FIELD = 1500;

const clip = (v) => String(v ?? '').slice(0, MAX_FIELD);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const doc = {
    at: clip(body.at) || new Date().toISOString(),
    label: clip(body.label) || 'panel',
    message: clip(body.message),
    stack: clip(body.stack),
    componentStack: clip(body.componentStack),
    url: clip(body.url),
    userAgent: clip(req.headers['user-agent']),
    receivedAt: new Date().toISOString(),
  };

  try {
    const token = await getGoogleAccessToken();
    await addDoc('client_errors', doc, token);
  } catch (e) {
    // No es crítico: el error ya quedó en el navegador del usuario.
    console.warn('[client-error] no se pudo guardar:', e?.message || e);
  }
  return res.status(204).end();
}
