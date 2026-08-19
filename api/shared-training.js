import { createRequire } from 'module';
const require_ = createRequire(import.meta.url);
const firebaseConfig = require_('../firebase-applet-config.json');

let trainingCache = { data: '', fetchedAt: 0 };
const TRAINING_TTL_MS = 30 * 1000;

async function firestoreToken() {
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!authRes.ok) {
    const err = await authRes.text();
    throw new Error(`Firebase auth failed (${authRes.status}): ${err.slice(0, 180)}`);
  }
  const { idToken } = await authRes.json();
  return idToken;
}

function docUrl() {
  const projectId = firebaseConfig.projectId;
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/config/main`;
}

export function invalidateTrainingCache() {
  trainingCache = { data: '', fetchedAt: 0 };
}

export async function getSharedTraining({ force = false } = {}) {
  if (!force && Date.now() - trainingCache.fetchedAt < TRAINING_TTL_MS && trainingCache.data !== '') {
    return trainingCache.data;
  }
  try {
    const idToken = await firestoreToken();
    const docRes = await fetch(docUrl(), { headers: { Authorization: `Bearer ${idToken}` } });
    if (!docRes.ok) return trainingCache.data;
    const doc = await docRes.json();
    const data = doc?.fields?.trainingData?.stringValue || '';
    trainingCache = { data, fetchedAt: Date.now() };
    return data;
  } catch (e) {
    console.warn('getSharedTraining failed:', e?.message);
    return trainingCache.data;
  }
}

export async function setSharedTraining(trainingData) {
  const text = typeof trainingData === 'string' ? trainingData : '';
  if (text.length > 500000) {
    throw new Error('Training text is too long (max 500,000 characters).');
  }
  const idToken = await firestoreToken();
  const url = `${docUrl()}?updateMask.fieldPaths=trainingData&updateMask.fieldPaths=trainingUpdatedAt`;
  const now = new Date().toISOString();
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        trainingData: { stringValue: text },
        trainingUpdatedAt: { stringValue: now },
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore write failed (${res.status}): ${err.slice(0, 240)}`);
  }
  trainingCache = { data: text, fetchedAt: Date.now() };
  return { ok: true, length: text.length, updatedAt: now };
}
