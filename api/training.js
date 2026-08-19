import { getSharedTraining, setSharedTraining, invalidateTrainingCache } from './shared-training.js';
import { sendTelegramAlert, escapeHtml } from './telegram-send.js';

function setCors(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const trainingData = await getSharedTraining();
      return res.status(200).json({
        ok: true,
        trainingData: trainingData || '',
        length: (trainingData || '').length,
      });
    }

    if (req.method === 'POST') {
      const trainingData = req.body?.trainingData;
      if (typeof trainingData !== 'string') {
        return res.status(400).json({ ok: false, error: 'trainingData string is required' });
      }
      const saved = await setSharedTraining(trainingData);
      invalidateTrainingCache();
      const reloaded = await getSharedTraining({ force: true });
      const loaded = reloaded === trainingData;
      const preview = (reloaded || '').trim().slice(0, 420);
      const telegramText = loaded
        ? [
            '✅ <b>ENTRENAMIENTO ACEPTADO</b>',
            '',
            'Estado: guardado y recargado desde la base de conocimiento en vivo',
            'Listo: SÍ — se usa en cada pregunta del cliente (chat y voz)',
            `Caracteres: ${saved.length}`,
            `Actualizado: ${saved.updatedAt}`,
            '',
            '<b>Vista previa</b>',
            `<pre>${escapeHtml(preview)}${(reloaded || '').length > 420 ? '…' : ''}</pre>`,
            '',
            'El asistente de recepción seguirá estas pautas en el próximo mensaje.',
          ].join('\n')
        : [
            '⚠️ <b>ENTRENAMIENTO NO COINCIDE</b>',
            '',
            'Se guardó, pero la recarga no coincide. No asuma que ya está en vivo.',
            `Escrito: ${trainingData.length} caracteres · Recargado: ${(reloaded || '').length} caracteres`,
            `Actualizado: ${saved.updatedAt}`,
          ].join('\n');

      let telegram = { sent: false };
      try {
        telegram = await sendTelegramAlert(telegramText);
      } catch (e) {
        telegram = { sent: false, error: e?.message || 'Telegram send failed' };
      }

      return res.status(200).json({
        ok: true,
        loaded,
        message: loaded
          ? (telegram.sent
            ? 'Entrenamiento aceptado, cargado y alerta de Telegram enviada. Listo para cada pregunta del cliente.'
            : 'Entrenamiento aceptado y cargado. No se pudo enviar la alerta de Telegram.')
          : 'Se guardó, pero la recarga no coincide. Revise Telegram o intente de nuevo.',
        telegram,
        ...saved,
      });
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (e) {
    console.error('training api:', e?.message);
    return res.status(500).json({ ok: false, error: e?.message || 'Training save failed' });
  }
}
