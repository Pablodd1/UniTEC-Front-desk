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
            '✅ <b>TRAINING ACCEPTED</b>',
            '',
            'Status: saved + reloaded from live knowledge base',
            'Ready: YES — used on every client question (chat + voice)',
            `Chars: ${saved.length}`,
            `Updated: ${saved.updatedAt}`,
            '',
            '<b>Preview</b>',
            `<pre>${escapeHtml(preview)}${(reloaded || '').length > 420 ? '…' : ''}</pre>`,
            '',
            'The Front Desk assistant will follow this on the next message.',
          ].join('\n')
        : [
            '⚠️ <b>TRAINING SAVE MISMATCH</b>',
            '',
            'Write succeeded but reload did not match. Do not assume it is live.',
            `Wrote: ${trainingData.length} chars · Reloaded: ${(reloaded || '').length} chars`,
            `Updated: ${saved.updatedAt}`,
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
            ? 'Training accepted, loaded, and Telegram approval sent. Ready for every client question.'
            : 'Training accepted and loaded. Telegram approval could not be sent.')
          : 'Saved, but reload did not match. Check Telegram / try again.',
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
