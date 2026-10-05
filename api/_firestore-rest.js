// api/_firestore-rest.js — tiny Firestore REST helper for serverless routes.
//
// Why this exists: escalation telemetry (was an escalation actually delivered? to whom?) and the
// staff-SLA stages must survive the request that produced them. Without it an alert that failed
// everywhere left no trace anywhere — the "no llegan a los monitores" complaint.
//
// Underscore-prefixed so Vercel does NOT expose it as an endpoint (verified: /api/_record-chat-turn → 404).
//
// REST pitfalls encoded here (each cost a round in this repo):
//  • Nested map fields under a masked update MUST be sent as nested mapValue + a dotted mask path.
//    A flat 'analytics.x' key silently does nothing while the commit still returns OK.
//  • Deleting/creating: list responses give RELATIVE doc paths; always prefix
//    https://firestore.googleapis.com/v1/ — unless you build the URL from projectId yourself.
//  • firebase-applet-config.json carries a UTF-8 BOM → require() is fine, manual JSON.parse is not.

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const firebaseConfig = require('../firebase-applet-config.json');

const PROJECT = firebaseConfig.projectId;
const API_KEY = firebaseConfig.apiKey;
const API = 'https://firestore.googleapis.com/v1';
const DOCS = `${API}/projects/${PROJECT}/databases/(default)/documents`;

const BASE_URL = () => `${DOCS}`;
export const docUrl = (path) => `${DOCS}/${path.split('/').map(encodeURIComponent).join('/')}`;

// Shared anonymous token (the same trick the recorder uses): minted once per instance, reused.
let cachedToken = null;
let tokenExpiry = 0;

export async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`firestore auth failed: ${res.status}`);
  const data = await res.json();
  cachedToken = data.idToken;
  tokenExpiry = Date.now() + (Number(data.expiresIn || 3600) - 120) * 1000;
  return cachedToken;
}

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') {
    return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
  }
  return { stringValue: String(v) };
}

export function fromValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) {
    return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromValue(x)]));
  }
  return null;
}

const toFields = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toValue(v)]));
const fromFields = (fields) => Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, fromValue(v)]));

/** Read a document; returns null when it does not exist. */
export async function getDoc(path) {
  const token = await getToken();
  const res = await fetch(docUrl(path), { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getDoc ${path}: ${res.status}`);
  const doc = await res.json();
  return { id: doc.name?.split('/').pop(), fields: fromFields(doc.fields) };
}

/**
 * Create or overwrite a document.
 * `maskPaths` = dotted paths to update (e.g. ['analytics.escalationCount']). Omit to write the
 * whole document. Nested objects are sent as nested mapValue automatically, which is what a dotted
 * mask path requires.
 */
export async function setDoc(path, fields, maskPaths = null) {
  const token = await getToken();
  const url = new URL(docUrl(path));
  if (maskPaths?.length) maskPaths.forEach((p) => url.searchParams.append('updateMask.fieldPaths', p));
  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(fields) }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`setDoc ${path}: ${res.status} ${body.slice(0, 200)}`);
  }
  return true;
}

/** Append a document with a generated id under `collection`. Returns the new id. */
export async function addDoc(collection, fields) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL()}/${collection.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(fields) }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`addDoc ${collection}: ${res.status} ${body.slice(0, 200)}`);
  }
  const doc = await res.json();
  return doc.name?.split('/').pop();
}

/**
 * Increment `path.field` by 1 atomically-enough for analytics: read → +1 → masked nested write.
 * Never throws: telemetry must never break the request it is describing.
 */
export async function bumpCounter(docPath, field, meta = {}) {
  try {
    const current = await getDoc(docPath);
    if (!current) return { ok: false, reason: 'session_missing' };
    const [map, key] = field.split('.');
    const mapFields = { ...(current.fields?.[map] || {}) };
    mapFields[key] = (Number(mapFields[key]) || 0) + 1;
    await setDoc(docPath, { [map]: mapFields, ...meta }, [map, ...Object.keys(meta)]);
    return { ok: true, value: mapFields[key] };
  } catch (err) {
    console.error('[firestore-rest] bumpCounter failed:', err?.message || err);
    return { ok: false, reason: String(err?.message || err) };
  }
}
