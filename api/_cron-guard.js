// api/_cron-guard.js
// Guardia de crons: SOLO el proyecto canónico de Vercel debe ejecutar los crons.
//
// Contexto (por qué existe): este repo está enlazado a dos proyectos de Vercel —
//   · unitec-front-desk    (prj_QmJmENFNCSfCo4JFntAsApwHviH3) → producción real
//   · uni-tec-front-desk   (duplicado viejo)  → sin RESEND_API_KEY, sin TWILIO_*, sin XAI_API_KEY
// Los dos despliegan el mismo vercel.json, así que los crons del duplicado corrían
// igual y escribían en el MISMO Firestore (config/main): reportes con
// channels.email=false / channels.sms=false y alertas "No Resend API key found in env"
// que el panel de producción mostraba como si fueran suyos.
//
// Regla: si la invocación viene del cron de Vercel (cabecera x-vercel-cron) y el
// proyecto que la recibe NO es el canónico, se responde 200 "skipped" y NO se toca
// Firestore, ni Telegram, ni Mission Control, ni se gastan tokens de IA.
//
// Fail-open a propósito: si VERCEL_PROJECT_ID no está definido (local, tests, otro host)
// el guardia no bloquea nada, para no romper nunca el proyecto bueno.

export const CANONICAL_PROJECT_ID = process.env.CANONICAL_PROJECT_ID || 'prj_QmJmENFNCSfCo4JFntAsApwHviH3';

/** ¿La invocación la hizo el cron de Vercel? */
export function isVercelCron(req) {
  const h = req?.headers || {};
  if (h['x-vercel-cron'] !== undefined && h['x-vercel-cron'] !== null && String(h['x-vercel-cron']) !== '') return true;
  return /vercel-cron/i.test(String(h['user-agent'] || ''));
}

/** ¿Es un cron disparado en un proyecto que no es el canónico? */
export function foreignCron(req) {
  if (!isVercelCron(req)) return false;
  const mine = String(process.env.VERCEL_PROJECT_ID || '');
  if (!mine) return false; // sin contexto de proyecto: no bloquear
  return mine !== CANONICAL_PROJECT_ID;
}

/**
 * Corta la ejecución si el cron viene de un proyecto ajeno.
 * @returns {boolean} true si ya respondió (hay que hacer `return`).
 */
export function skipForeignCron(req, res) {
  if (!foreignCron(req)) return false;
  try {
    res.status(200).json({
      ok: true,
      skipped: 'foreign_project',
      project: process.env.VERCEL_PROJECT_ID,
      canonical: CANONICAL_PROJECT_ID,
    });
  } catch { /* si la respuesta ya estaba enviada, no es fatal */ }
  return true;
}
