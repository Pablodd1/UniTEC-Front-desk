import { createRequire } from 'module';
import { getFirestoreToken } from './_analytics-core.js';
const require_ = createRequire(import.meta.url);
const firebaseConfig = require_('../firebase-applet-config.json');

let trainingCache = { data: '', fetchedAt: 0, updatedAt: '', prevLength: 0 };
const TRAINING_TTL_MS = 5 * 60 * 1000; // was 30s — sparse traffic paid a fresh anonymous signUp on nearly every message

function docUrl() {
  const projectId = firebaseConfig.projectId;
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/config/main`;
}

export function invalidateTrainingCache() {
  trainingCache = { data: '', fetchedAt: 0, updatedAt: '', prevLength: 0 };
}

export async function getSharedTraining({ force = false } = {}) {
  if (!force && Date.now() - trainingCache.fetchedAt < TRAINING_TTL_MS && trainingCache.data !== '') {
    return trainingCache.data;
  }
  try {
    const idToken = await getFirestoreToken();
    const docRes = await fetch(docUrl(), { headers: { Authorization: `Bearer ${idToken}` } });
    if (!docRes.ok) return trainingCache.data;
    const doc = await docRes.json();
    const data = doc?.fields?.trainingData?.stringValue || '';
    trainingCache = {
      data,
      fetchedAt: Date.now(),
      updatedAt: doc?.fields?.trainingUpdatedAt?.stringValue || '',
      prevLength: (doc?.fields?.trainingDataPrev?.stringValue || '').length,
    };
    return data;
  } catch (e) {
    console.warn('getSharedTraining failed:', e?.message);
    return trainingCache.data;
  }
}

export async function setSharedTraining(trainingData, { append = false } = {}) {
  const incoming = typeof trainingData === 'string' ? trainingData : '';
  if (incoming.length > 500000) {
    throw new Error('Training text is too long (max 500,000 characters).');
  }
  // Read the current blob first: it becomes trainingDataPrev (recoverable) and, in append
  // mode, the base the new note is added to. Saving used to REPLACE everything with no
  // history — a new note pasted in the panel silently destroyed every pauta before it.
  const previous = await getSharedTraining({ force: true });
  const text = append && previous.trim() ? `${previous.trim()}\n\n---\n${incoming.trim()}` : incoming;
  const idToken = await getFirestoreToken();
  const url = `${docUrl()}?${['trainingData', 'trainingUpdatedAt', 'trainingDataPrev'].map((f) => `updateMask.fieldPaths=${f}`).join('&')}`;
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
        trainingDataPrev: { stringValue: previous || '' },
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore write failed (${res.status}): ${err.slice(0, 240)}`);
  }
  trainingCache = { data: text, fetchedAt: Date.now(), updatedAt: now, prevLength: (previous || '').length };
  return { ok: true, length: text.length, updatedAt: now, appended: Boolean(append && previous.trim()), prevLength: (previous || '').length };
}

/** Live training metadata — lets the panel show WHEN and WHAT is actually in effect. */
export function getSharedTrainingMeta() {
  return { updatedAt: trainingCache.updatedAt, prevLength: trainingCache.prevLength, length: (trainingCache.data || '').length };
}
