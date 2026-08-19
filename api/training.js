import { getSharedTraining, setSharedTraining } from './shared-training.js';

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
      return res.status(200).json({
        ok: true,
        message: 'Training saved. The assistant will use this on the next message.',
        ...saved,
      });
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (e) {
    console.error('training api:', e?.message);
    return res.status(500).json({ ok: false, error: e?.message || 'Training save failed' });
  }
}
