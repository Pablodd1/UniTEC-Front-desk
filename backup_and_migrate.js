import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { 
  getFirestore, 
  collectionGroup, 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  writeBatch 
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Read config and strip UTF-8 BOM if present
const firebaseConfig = JSON.parse(
  fs.readFileSync('./firebase-applet-config.json', 'utf8').replace(/^\uFEFF/, '')
);

// Init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function run() {
  try {
    console.log('🔑 Signing in anonymously to Firebase...');
    await signInAnonymously(auth);
    console.log('✅ Authenticated successfully!');

    // 1. Fetch all legacy sessions from the collection group 'chatSessions'
    console.log('🔄 Fetching legacy chat sessions from collectionGroup("chatSessions")...');
    const legacySnapshot = await getDocs(collectionGroup(db, 'chatSessions'));
    console.log(`📊 Found ${legacySnapshot.size} legacy chat sessions.`);

    const legacySessions = [];
    for (const d of legacySnapshot.docs) {
      const data = d.data();
      legacySessions.push({
        id: d.id,
        path: d.ref.path,
        ...data
      });
    }

    // 2. Fetch all current sessions in the new 'conversations' collection
    console.log('🔄 Fetching current conversation sessions...');
    const currentSnapshot = await getDocs(collection(db, 'conversations'));
    console.log(`📊 Found ${currentSnapshot.size} current conversations.`);

    const currentSessions = [];
    for (const d of currentSnapshot.docs) {
      const data = d.data();
      // Fetch messages for this session
      const msgsSnapshot = await getDocs(collection(db, `conversations/${d.id}/messages`));
      const messages = msgsSnapshot.docs.map(m => m.data());
      currentSessions.push({
        ...data,
        messages
      });
    }

    // 3. Migrate missing legacy sessions to the new root collection
    console.log('🚀 Migrating missing legacy sessions to root conversations collection...');
    let migratedCount = 0;
    
    // We will do this in batches of 500
    let batch = writeBatch(db);
    let batchSize = 0;

    for (const old of legacySessions) {
      // Check if already exists in the current conversations
      const exists = currentSessions.some(c => c.id === old.id);
      if (!exists) {
        const newSessionRef = doc(db, 'conversations', old.id);
        const mappedSession = {
          id: old.id,
          status: old.status || 'completed',
          brandId: old.brandId || 'unitec',
          language: old.language || 'es',
          createdAt: old.timestamp || old.lastUpdated || new Date().toISOString(),
          lastUpdated: old.lastUpdated || new Date().toISOString(),
          source: old.type === 'call' ? 'phone' : 'web',
          topics: old.intent_category ? [old.intent_category] : [],
          analytics: {
            messageCount: old.messages?.length || 0,
            avgResponseTime: 0,
            escalationCount: 0,
            productMentions: []
          },
          legacy: true
        };

        if (old.customerName) {
          mappedSession.tags = [old.customerName];
        }

        batch.set(newSessionRef, mappedSession, { merge: true });
        batchSize++;

        // Map messages
        if (old.messages && Array.isArray(old.messages)) {
          for (const msg of old.messages) {
            const msgId = msg.id || `msg_${Math.random().toString(36).substring(2, 9)}`;
            const msgRef = doc(db, `conversations/${old.id}/messages`, msgId);
            batch.set(msgRef, {
              id: msgId,
              role: msg.role === 'model' || msg.role === 'assistant' ? 'model' : 'user',
              text: msg.text || msg.content || '',
              timestamp: msg.timestamp || mappedSession.createdAt
            }, { merge: true });
            batchSize++;

            if (batchSize >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              batchSize = 0;
            }
          }
        }

        migratedCount++;

        // Add to our local current sessions array so we can back it up
        currentSessions.push({
          ...mappedSession,
          messages: old.messages || []
        });
      }
    }

    if (batchSize > 0) {
      await batch.commit();
    }
    console.log(`✅ Migration complete! Migrated ${migratedCount} new sessions.`);

    // 4. Save a complete local backup of all chats
    const backupPath = './chats_backup.json';
    console.log(`💾 Saving all ${currentSessions.length} conversations to local backup at ${backupPath}...`);
    fs.writeFileSync(backupPath, JSON.stringify(currentSessions, null, 2), 'utf8');
    console.log('✅ Local backup saved successfully!');

  } catch (error) {
    console.error('❌ Error during backup & migration:', error);
  }
}

run();
