# UniTEC Front Desk — Developer Instructions

## What Has Been Fixed (Already Applied)

### P0 — Critical Security
1. **Firestore rules** (`firestore.rules`) — Public read/write closed. Only staff can read conversations/messages. Public can still create conversations/messages (for visitor chat), but cannot read or update them.
2. **Auth bypass** (`App.tsx`, `firestoreService.ts`) — Removed `sessionStorage.getItem('unitec_local_admin')` bypass. Only Firebase Auth now works.
3. **Gemini API key in Firestore** (`AdminDashboard.tsx`) — `saveAppConfig` no longer includes `geminiApiKey`. Key stays in localStorage + server env vars only.
4. **API key endpoint** (`api/gemini-key.js`) — Now requires `Authorization: Bearer <ADMIN_SECRET>` or `?token=<ADMIN_SECRET>` query param. CORS restricted to `ALLOWED_ORIGINS`. Added request timeout.
5. **Hardcoded email** (`api/notify-email.js`) — Now reads `to` from request body. Falls back to `ADMIN_EMAIL` env var, then `jasmelacosta@gmail.com`.
6. **ChatTab session ID** (`ChatTab.tsx`) — Removed duplicate `sessionId` ref. All paths now use `conversationId` from `createConversation`.
7. **Fix scripts** — 24 `fix_*.cjs`, `patch*.cjs`, `restore*.cjs`, `update_*.cjs` moved to `.archive/fix-scripts/`.

---

## What You Must Fix (Developer Action Required)

### 1. DEPLOY FIRESTORE RULES
```bash
firebase deploy --only firestore:rules
```
The new rules require Firebase Auth with custom claims for staff/admin access.
You need to add custom claims to admin users:
```bash
# In Firebase Console or via Admin SDK:
# Set { admin: true, role: 'admin' } on admin user tokens
```

### 2. SET ENVIRONMENT VARIABLES ON VERCEL
Add these to Vercel Dashboard → Settings → Environment Variables:

| Variable | Purpose | Required |
|----------|---------|----------|
| `ADMIN_SECRET` | Shared secret for `/api/gemini-key` auth | YES |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (e.g. `https://yourdomain.com`) | YES |
| `ADMIN_EMAIL` | Fallback email for notifications | No |
| `RESEND_API_KEY` | Resend.com API key for email | YES |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | YES |
| `TELEGRAM_CHAT_ID` | Telegram chat ID for notifications | YES |
| `GEMINI_API_KEY` | Primary Gemini API key | YES |
| `GEMINI_BACKUP_KEY` | Backup Gemini key (optional) | No |
| `GEMINI_BACKUP_KEY_2` | Second backup (optional) | No |

### 3. ADD FIRESTORE COMPOSITE INDEXES
Create `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "conversations",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "lastUpdated", "order": "DESCENDING"}
      ]
    },
    {
      "collectionGroup": "conversations",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "brandId", "order": "ASCENDING"},
        {"fieldPath": "lastUpdated", "order": "DESCENDING"}
      ]
    },
    {
      "collectionGroup": "conversations",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "createdAt", "order": "DESCENDING"}
      ]
    },
    {
      "collectionGroup": "interventions",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "requestedAt", "order": "DESCENDING"}
      ]
    }
  ]
}
```
Deploy: `firebase deploy --only firestore:indexes`

### 4. FIX MESSAGE STORAGE ARCHITECTURE
Current problem: Messages are stored as subcollection AND embedded in session doc array. Session doc has 1MB limit.

In `services/conversationService.ts`:
- The `messages` field on `ConversationSession` should NOT be populated on create/update
- When reading a session, load messages separately via `getMessages(sessionId)`
- The session doc should only store metadata (status, customer info, analytics)

In `components/AdminDashboard.tsx`:
- When displaying a conversation, fetch messages via `subscribeToMessages(sessionId)` instead of reading `session.messages`

### 5. ADD PAGINATION TO CONVERSATION LIST
In `services/conversationService.ts`, modify `subscribeToConversations`:
```typescript
// Current: loads ALL conversations (will OOM browser at scale)
// Fix: add limit + cursor-based pagination
const q = query(
  collection(db, COLLECTIONS.sessions),
  orderBy('lastUpdated', 'desc'),
  limit(50)  // Page size
);
```

In `AdminDashboard.tsx`, add "Load More" button that increments limit.

### 6. ADD RATE LIMITING
Vercel serverless functions have no built-in rate limiting. Options:
- **Vercel KV** (recommended): Use `@upstash/ratelimit` with Vercel KV
- **Vercel WAF**: Configure in Vercel Dashboard → Security → WAF
- **Firebase**: Move sensitive endpoints to Firebase Cloud Functions with App Check

### 7. FIX analyticsDashboard — CLIENT-SIDE AGGREGATION
`components/AnalyticsDashboard.tsx` renders ALL sessions client-side. At 10K+ sessions, browser will freeze.

Fix: Create a Firestore `analytics/daily` aggregation doc that runs via a scheduled Cloud Function:
```typescript
// Cloud Function — runs every hour
exports.aggregateDaily = functions.pubsub
  .schedule('every 60 minutes')
  .onRun(async () => {
    // Query recent sessions, compute totals
    // Write to analytics/daily/{date} doc
  });
```

### 8. REMOVE FAKE TELEMETRY
In `AdminDashboard.tsx`, the `liveLogs` interval (line 167-176) generates random fake messages:
```
"API: generateContent stream heartbeat - OK"
"AUDIO: Handshaking live PCM receiver node"
```
Replace with actual Firestore `onSnapshot` listeners or Health Service checks.

### 9. SPLIT constants.ts (5,349 lines)
Move to:
- `constants/products.ts` — product catalog
- `constants/ui.ts` — UI translations
- `constants/config.ts` — business configs
- `constants/training.ts` — training data

### 10. CALL RECORDINGS — MOVE FROM localStorage TO FIRESTORE
`CallTab.tsx` stores recordings in `localStorage.getItem('unitec_call_library')`.
Move to Firestore: `users/{userId}/callRecordings/{id}` (collection already exists).

### 11. FIX acceptIntervention — USE DIRECT DOC LOOKUP
`services/conversationService.ts` line 254: queries all interventions filtered by ID.
Replace with: `const interventionDoc = await getDoc(doc(db, COLLECTIONS.interventions, interventionId));`

### 12. ADD INPUT VALIDATION
Add message size limits in `addMessage`:
```typescript
if (message.text.length > 10000) {
  console.warn('Message too large, truncating');
  message.text = message.text.substring(0, 10000);
}
```

---

## Deployment Checklist
- [ ] Deploy Firestore rules: `firebase deploy --only firestore:rules`
- [ ] Deploy Firestore indexes: `firebase deploy --only firestore:indexes`
- [ ] Set ALL Vercel env vars listed above
- [ ] Add Firebase custom claims to admin users
- [ ] Run `npm install` then `npm run build` — verify no new errors
- [ ] Test: visitor can create conversation but NOT read others
- [ ] Test: `/api/gemini-key` returns 401 without token
- [ ] Test: `/api/gemini-key` returns key with valid token
- [ ] Test: `/api/notify-email` accepts dynamic `to` field
- [ ] Deploy to Vercel: `vercel --prod`
