// api/_email.js
// Envío de email por Resend con cadena de remitentes.
//
// Por qué existe: en producción conviven DOS cuentas de Resend.
//   · RESEND_API_KEY      → cuenta con cedexx.net VERIFICADO. Es la que entrega hoy (alertas@cedexx.net).
//   · RESEND_API_KEY_ALT  → clave nueva, guardada como "sensitive". Su cuenta no tiene todavía un
//                           dominio verificado, así que responde 403 "domain is not verified".
// Si alguien rota las claves y la primaria queda inservible, el email se caía en silencio. Con esta
// cadena se intenta la primaria y, SOLO si el fallo es del remitente (clave inválida, clave restringida,
// dominio sin verificar), se reintenta con la siguiente. Un error del destinatario o del contenido
// (422 validation_error) no se reintenta: no lo arregla otra clave.
//
// Remitente por clave: RESEND_FROM (primaria) y RESEND_FROM_ALT (alterna, cae a RESEND_FROM si falta).

const DEFAULT_FROM = 'UniTEC AI Desk <alertas@cedexx.net>';
const clean = (v) => String(v || '').trim().replace(/^["']|["']$/g, '');

/** Remitentes disponibles, en orden de intento. */
export function resendSenders() {
  const list = [];
  const primaryKey = clean(process.env.RESEND_API_KEY) || clean(process.env.RESEND_KEY);
  if (primaryKey) {
    list.push({ via: 'primary', key: primaryKey, from: clean(process.env.RESEND_FROM) || DEFAULT_FROM });
  }
  const altKey = clean(process.env.RESEND_API_KEY_ALT);
  if (altKey) {
    list.push({
      via: 'alt',
      key: altKey,
      from: clean(process.env.RESEND_FROM_ALT) || clean(process.env.RESEND_FROM) || DEFAULT_FROM,
    });
  }
  return list;
}

/** ¿El fallo es del remitente (clave/dominio) y por tanto vale la pena probar otra clave? */
export function isSenderLevelFailure(status, message) {
  const m = String(message || '');
  if (status === 401 || status === 403) return true;
  return /not verified|restricted_api_key|api ?key is invalid|incorrect api key|missing_api_key|unauthorized|forbidden/i.test(m) && !/invalid `to`|invalid `from` field/i.test(m);
}

/**
 * Envía un email probando los remitentes en orden.
 * @param {{subject:string, html:string, to:string|string[], timeoutMs?:number, fetchImpl?:Function}} opts
 * @returns {Promise<{success:boolean, data?:any, via?:string, from?:string, error?:string, status?:number, attempts:Array}>}
 */
export async function sendEmail({ subject, html, to, timeoutMs = 8000, fetchImpl = globalThis.fetch }) {
  const senders = resendSenders();
  const recipients = Array.isArray(to) ? to : [to];
  if (!senders.length) return { success: false, error: 'No Resend API key found in env', attempts: [] };

  const attempts = [];
  for (const s of senders) {
    try {
      const r = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.key}` },
        body: JSON.stringify({ from: s.from, to: recipients, subject, html }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok) return { success: true, data: body, via: s.via, from: s.from, attempts };

      const message = body?.message || body?.error || `HTTP ${r.status}`;
      attempts.push({ via: s.via, status: r.status, error: message, from: s.from });
      if (!isSenderLevelFailure(r.status, message)) {
        return { success: false, error: message, status: r.status, data: body, via: s.via, attempts };
      }
    } catch (e) {
      attempts.push({ via: s.via, status: 0, error: String(e?.message || e), from: s.from });
    }
  }
  const last = attempts[attempts.length - 1] || {};
  return { success: false, error: last.error || 'email_failed', status: last.status || 0, attempts };
}
