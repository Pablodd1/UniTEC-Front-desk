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

// Cuarentena por remitente: si un dominio responde "not verified" no se reintenta durante 30 min.
// Sin esto, cada alerta pagaría ~300 ms de 403 antes de caer al remitente bueno. Vive en memoria
// del lambda (se reinicia solo, coste cero) y nunca deja la lista vacía.
const DOWN_MS = 30 * 60 * 1000;
const downUntil = new Map();

/**
 * Remitentes disponibles, en orden de intento.
 * Preferencia dentro de cada clave: marca (RESEND_FROM_BRAND) → configurado (RESEND_FROM) →
 * histórico (cedexx). Así el día que el dominio de la marca quede verificado los envíos salen
 * con la marca SIN tocar código ni variables, y si esa verificación se cae el correo sigue
 * saliendo por el remitente que ya funcionaba en lugar de morir en silencio.
 */
export function resendSenders() {
  const keys = [];
  const primaryKey = clean(process.env.RESEND_API_KEY) || clean(process.env.RESEND_KEY);
  if (primaryKey) keys.push({ via: 'primary', key: primaryKey });
  const altKey = clean(process.env.RESEND_API_KEY_ALT);
  if (altKey) keys.push({ via: 'alt', key: altKey });

  // Orden: primero el REMITENTE que queremos (marca), después el histórico. Para cada remitente se
  // prueban todas las claves. Así, cuando el dominio de marca quede verificado en la cuenta de la
  // clave alterna, el correo sale con la marca aunque la cuenta primaria no tenga ese dominio — en
  // lugar de quedarse eternamente en el remitente viejo solo porque la primaria responde antes.
  const froms = [];
  for (const f of [clean(process.env.RESEND_FROM_BRAND), clean(process.env.RESEND_FROM), DEFAULT_FROM]) {
    if (f && !froms.includes(f)) froms.push(f);
  }

  const out = [];
  const now = Date.now();
  for (const f of froms) {
    for (const k of keys) {
      if ((downUntil.get(k.via + ':' + f) || 0) > now) continue;
      out.push({ via: k.via, key: k.key, from: f });
    }
  }
  if (!out.length && keys.length) {
    out.push({ via: keys[0].via, key: keys[0].key, from: clean(process.env.RESEND_FROM) || DEFAULT_FROM });
  }
  return out;
}

/** ¿El fallo es de la CLAVE (no del remitente)? Entonces no sirve probar otro 'from' con la misma
 *  clave: hay que pasar a la siguiente cuenta. */
export function isKeyLevelFailure(status, message) {
  const m = String(message || '');
  if (status === 401) return true;
  return /restricted_api_key|api ?key is invalid|incorrect api key|missing_api_key|unauthorized/i.test(m);
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
  const deadKeys = new Set();
  for (const s of senders) {
    if (deadKeys.has(s.via)) continue;
    try {
      // Reply-To: sin esto, un cliente que responde a una alerta escribe a la dirección
      // técnica del remitente (alertas@cedexx.net) y el correo se pierde. Se apunta a la
      // bandeja real de ventas/administración.
      const replyTo = clean(process.env.RESEND_REPLY_TO) || clean(process.env.ADMIN_EMAIL) || '';
      const payload = { from: s.from, to: recipients, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) };
      const r = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.key}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok) return { success: true, data: body, via: s.via, from: s.from, attempts };

      const message = body?.message || body?.error || `HTTP ${r.status}`;
      attempts.push({ via: s.via, status: r.status, error: message, from: s.from });
      if (/not verified|restricted_api_key|invalid api ?key/i.test(message)) {
        downUntil.set(s.via + ':' + s.from, Date.now() + DOWN_MS);
      }
      // Clave muerta: no perder tiempo probando otro remitente con la misma clave.
      if (isKeyLevelFailure(r.status, message)) {
        deadKeys.add(s.via);
        continue;
      }
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
