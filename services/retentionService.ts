import { db } from '../firebase';
import { collection, query, getDoc, updateDoc, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getPrivacyMode } from './firestoreService';
import { ConversationSession, ConversationMessage } from './conversationService';
import { onSnapshot } from 'firebase/firestore';

export interface ArchivedConversation {
  id: string;
  originalSessionId: string;
  brandId: 'unitec' | 'building';
  language: 'en' | 'es';
  summary: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  topics: string[];
  messageCount: number;
  status: string;
  createdAt: string;
  endedAt: string;
  archivedAt: string;
  source: string;
  intentCategory?: string;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function generateSummaryWithGemini(
  session: ConversationSession,
  messages: ConversationMessage[]
): Promise<string> {
  try {
    const apiKey = localStorage.getItem('unitec_gemini_api_key') || '';
    if (!apiKey) return buildFallbackSummary(session, messages);

    const conversationText = messages
      .filter(m => m.role === 'user' || m.role === 'model')
      .slice(0, 30)
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Bot'}: ${m.text.substring(0, 300)}`)
      .join('\n');

    const prompt = `Eres un asistente que resume conversaciones de chatbot para archivo. Resume esta conversacion en 2-3 oraciones en español. Incluye: tema principal, si el cliente quiso hablar con humano, y resultado.\n\nCONVERSACION:\n${conversationText}\n\nRESUMEN:`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 150, temperature: 0.3 }
        })
      }
    );

    if (res.ok) {
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || buildFallbackSummary(session, messages);
    }
  } catch (e) {
    console.warn('[Retention] Gemini summary failed, using fallback:', e);
  }
  return buildFallbackSummary(session, messages);
}

function buildFallbackSummary(session: ConversationSession, messages: ConversationMessage[]): string {
  const msgCount = messages.length;
  const hadIntervention = session.status === 'human_requested' || session.status === 'human_assigned';
  const topics = session.topics?.join(', ') || 'consulta general';
  return `Conversacion de ${msgCount} mensajes sobre ${topics}. ${hadIntervention ? 'El cliente solicito atencion humana.' : 'Atendida por IA.'} Estado final: ${session.status}.`;
}



export interface RetentionResult {
  archived: number;
  deleted: number;
  errors: number;
}

export const summarizeAndArchiveOldConversations = async (): Promise<RetentionResult> => {
  const result: RetentionResult = { archived: 0, deleted: 0, errors: 0 };
  if (getPrivacyMode()) return result;

  try {
    const cutoffDate = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
    const snapshot = await getDocs(collection(db, 'conversations'));

    const oldSessions = snapshot.docs
      .map(d => d.data() as ConversationSession & { isArchived?: boolean })
      .filter(s => !s.isArchived && s.createdAt < cutoffDate && (s.status === 'completed' || s.status === 'abandoned'));

    for (const session of oldSessions) {
      try {
        const messagesSnap = await getDocs(collection(db, 'conversations', session.id, 'messages'));
        const messages = messagesSnap.docs.map(d => d.data() as ConversationMessage);
        const summary = await generateSummaryWithGemini(session, messages);

        const archive: ArchivedConversation = {
          id: `archive_${session.id}`,
          originalSessionId: session.id,
          brandId: session.brandId,
          language: session.language || 'es',
          summary,
          customerName: session.customerName,
          customerEmail: session.customerEmail,
          customerPhone: session.customerPhone,
          topics: session.topics || [],
          messageCount: messages.length,
          status: session.status,
          createdAt: session.createdAt,
          endedAt: session.lastUpdated,
          archivedAt: new Date().toISOString(),
          source: session.source || 'web',
          intentCategory: session.intentCategory,
        };

        await setDoc(doc(db, 'conversation_archives', archive.id), archive);
        result.archived++;
        // User requested full memory: DO NOT delete messages or session
        // await deleteSessionMessages(session.id);
        // await deleteDoc(doc(db, 'conversations', session.id));
        await updateDoc(doc(db, 'conversations', session.id), { isArchived: true });
        result.deleted++; // Keeping counter for backwards compatibility of RetentionResult
      } catch (e) {
        console.error(`[Retention] Failed to archive ${session.id}:`, e);
        result.errors++;
      }
    }
  } catch (e) {
    console.error('[Retention] Sweep failed:', e);
    result.errors++;
  }

  return result;
};

export const subscribeToArchives = (
  callback: (archives: ArchivedConversation[]) => void
): (() => void) => {
  if (getPrivacyMode()) { callback([]); return () => {}; }
  const archivesRef = collection(db, 'conversation_archives');
  return onSnapshot(
    query(archivesRef),
    snapshot => {
      const archives = snapshot.docs.map(d => d.data() as ArchivedConversation);
      archives.sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
      callback(archives);
    },
    e => console.error('[Retention] Archive subscription error:', e)
  );
};

export const deleteArchive = async (archiveId: string): Promise<void> => {
  await deleteDoc(doc(db, 'conversation_archives', archiveId));
};


export const summarizeSessionNow = async (sessionId: string): Promise<void> => {
  try {
    const sessionRef = doc(db, 'conversations', sessionId);
    const sessionSnap = await getDoc(sessionRef);
    if (!sessionSnap.exists()) return;
    
    const session = sessionSnap.data() as ConversationSession;
    const messagesSnap = await getDocs(collection(db, 'conversations', sessionId, 'messages'));
    const messages = messagesSnap.docs.map(d => d.data() as ConversationMessage);
    
    const summary = await generateSummaryWithGemini(session, messages);
    await updateDoc(sessionRef, { summary });
    console.log('[Retention] Summarized concluded session:', sessionId);
  } catch (e) {
    console.error('[Retention] Failed to summarize concluded session:', e);
  }
};



