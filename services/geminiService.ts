// @ts-nocheck
// geminiService.ts — Handles all AI API communication
// Provider: OpenRouter (primary) | Gemini REST (fallback if AIza key)
// Architecture: API key fetched once + cached in module scope, 3-attempt retry with exponential backoff

import { GoogleGenAI, LiveServerMessage, Modality, GenerateContentResponse } from "@google/genai";
import { getSystemInstruction, TOOLS, PRODUCTS } from "../constants";
import { decodeAudioData, decode, encode, pcmToWavBlob } from "../utils/audioUtils";
import { Language, VoiceName } from "../types";
import { trackUsage } from "./usageService";

// ─── API Key Cache ─────────────────────────────────────────────────────────
// Cached in module memory so we only call /api/gemini-key once per page load.
let cachedApiKey = '';

export async function getApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;

  // 1. Admin override via localStorage (Admin Settings panel)
  const localKey = typeof window !== 'undefined' ? window.localStorage.getItem('unitec_gemini_api_key') : null;
  if (localKey) { cachedApiKey = localKey; return localKey; }

  // 2. Secure server endpoint (Vercel function) — primary path in production
  try {
    const res = await fetch('/api/gemini-key', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.apiKey) {
        cachedApiKey = data.apiKey;
        return cachedApiKey;
      }
    }
  } catch (_) { /* server unreachable — fall through */ }

  // 3. Build-time env vars (development fallback)
  if (typeof process !== 'undefined' && process.env) {
    const pKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (pKey) { cachedApiKey = pKey; return pKey; }
  }
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const metaKey = import.meta.env.VITE_OPENROUTER_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
    if (metaKey) { cachedApiKey = metaKey; return metaKey; }
  }
  return '';
}

/** Call this to force re-fetch on next message (e.g. after admin saves a new key). */
export const resetApiKeyCache = (): void => { cachedApiKey = ''; };
export const resetChatSession = () => {
  // Clear chat history from localStorage when brand/language changes
  if (typeof window !== 'undefined') {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('unitec_chat_history_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Failed to reset chat session:', e);
    }
  }
};

import { speakTextWithDeepgram } from './deepgramService';

// ─── TTS ────────────────────────────────────────────────────────────────────
export async function playGeminiTTS(text: string, voiceName: string = 'Kore') {
  const isSpanish = /[áéíóúüñ¿¡]/i.test(text) || text.toLowerCase().includes('hola') || text.toLowerCase().includes('bienvenido');
  const model = isSpanish ? 'aura-2-celeste-es' : 'aura-asteria-en';
  return speakTextWithDeepgram(text, model, isSpanish ? 'es' : 'en');
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const RETRY_DELAYS = [1000, 2000]; // ms between attempts 1→2 and 2→3

const performCatalogSearch = async (query: string, brandId: string) => {
    try {
        const req = await fetch('/products.json');
        const products = await req.json();
        const lowerQ = query.toLowerCase();
        return products.filter(p => 
            p.name.toLowerCase().includes(lowerQ) || 
            p.id.toLowerCase().includes(lowerQ) ||
            p.category.toLowerCase().includes(lowerQ)
        ).slice(0, 10).map(p => ({
            id: p.id,
            name: p.name,
            price: brandId === 'unitec' ? p.price_cop : p.price_usd,
            stock_status: p.stock_status,
            description: p.description
        }));
    } catch (e) {
        return { error: "Catalog unavailable" };
    }
};

// Cached current conversation session id — set by ChatTab so /api/chat can
// record every real chat turn server-side (analytics ground truth).
let currentSessionId = '';
export const setCurrentChatSessionId = (id: string) => { currentSessionId = id; };

export async function* sendMessageToGemini(
  message: string,
  history: any[] = [],
  emergencyMode: boolean = false,
  language: any = 'es',
  onToolSuccess?: (toolName: string, result: any) => void,
  customGreeting?: string,
  brandId: any = 'building',
  isVoiceMode: boolean = false
): AsyncGenerator<any, void, unknown> {

  // Authoritative training comes from the server (/api/chat injects Firestore
  // config/main.trainingData). Do NOT read a browser-cached copy — stale localStorage
  // was overriding the dashboard's latest pautas. Keep it undefined so the server wins.
  const localTraining = undefined;
  let instructions = getSystemInstruction(language, customGreeting, brandId, localTraining, isVoiceMode);
  if (emergencyMode) instructions += '\n\n[SYSTEM OVERRIDE: EMERGENCY MODE ACTIVE]. Respond concisely.';

  // 1. Primary path: Call secure serverless proxy (/api/chat) with retry for rate limits
  let lastProxyError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const proxyRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: (history || []).map((h) => ({
            role: h.role,
            text: h.text || h.parts?.[0]?.text || h.content || '',
            parts: h.parts,
          })),
          instructions,
          brandId,
          sessionId: currentSessionId || undefined,
          parentHost: typeof document !== 'undefined' ? (document.referrer || '') : '',
        }),
        signal: AbortSignal.timeout(40000)
      });

      if (proxyRes.status === 429) {
        // Rate limited — wait 3s and retry once
        if (attempt === 0) {
          await sleep(3000);
          continue;
        }
        throw new Error('RATE_LIMITED');
      }

      if (proxyRes.ok) {
        const data = await proxyRes.json();
        if (data.text) {
          yield data.text;
          return;
        }
      }
      const errBody = await proxyRes.text().catch(() => '');
      lastProxyError = new Error(`Proxy ${proxyRes.status}: ${errBody.slice(0, 200)}`);
    } catch (proxyError) {
      lastProxyError = proxyError;
      if (attempt === 0 && !String(proxyError).includes('RATE_LIMITED')) {
        // Only retry on rate limit, not on network errors
        break;
      }
    }
  }

  // 2. All proxy attempts failed — throw structured error (NO direct client-side API key usage)
  console.warn('Chat proxy unreachable:', lastProxyError?.message || lastProxyError);
  throw new Error('PROXY_UNREACHABLE');
}

// ─── Voice / Live Session ────────────────────────────────────────────────────
// State machine: 'idle' → 'listening' → 'processing' → 'speaking' → 'listening' → ...
// Fixes: continuous recognition, proper TTS/STT sequencing, echo prevention
export const connectLiveSession = async (
  callbacks: any,
  emergencyMode: boolean = false,
  language: any = 'es',
  voiceName: string = 'Kore',
  customGreeting?: string,
  brandId: any = 'building'
) => {
  let isRecording = true;
  let recognition: any = null;
  let voiceState: 'idle' | 'listening' | 'processing' | 'speaking' | 'stopped' = 'idle';
  const messageHistory: any[] = []; // Conversation context for AI calls
  const localTraining = undefined; // server training is authoritative (see sendMessageToGemini)
  const instructions = getSystemInstruction(language, customGreeting, brandId, localTraining, true);

  const setState = (s: typeof voiceState) => {
    voiceState = s;
    callbacks.onStatusChange?.(s);
  };

  const safeStartRecognition = () => {
    if (!isRecording || voiceState === 'stopped' || voiceState === 'speaking' || voiceState === 'processing') return;
    if (!recognition) return;
    try {
      recognition.start();
    } catch (e: any) {
      // start() throws if already started — that's fine, we're already listening
      if (!String(e).includes('already started')) {
        // Retry after short delay for transient errors
        setTimeout(() => {
          if (isRecording && voiceState === 'idle') safeStartRecognition();
        }, 500);
      }
    }
  };

  const stopRecognition = () => {
    if (!recognition) return;
    try { recognition.stop(); } catch (_) {}
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
  } catch {
    callbacks.onError(new Error('Microphone permission denied. Please allow access and try again.'));
    return { disconnect: async () => {}, getAudioBlob: () => new Blob(), stream: null };
  }

  setTimeout(() => callbacks.onOpen(), 100);

  const hasWebSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  const SpeechRecognitionCtor = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

  if (hasWebSpeech && SpeechRecognitionCtor) {
    recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;    // Keep listening across multiple utterances
    recognition.interimResults = false; // Only final results to avoid partial triggers
    recognition.lang = language === 'en' ? 'en-US' : 'es-CO';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState('listening');
      // Dummy audio data for visualizer
      const interval = setInterval(() => {
        if (!isRecording || voiceState !== 'listening') clearInterval(interval);
        if (callbacks.onAudioData) callbacks.onAudioData(new Uint8Array(64).fill(128));
      }, 100);
    };

    recognition.onresult = async (event: any) => {
      // Only process the latest final result
      const lastResult = event.results[event.results.length - 1];
      if (!lastResult || !lastResult.isFinal) return;

      const transcript = lastResult[0].transcript.trim();
      if (!transcript) return;

      // Stop listening while processing + speaking (prevents echo capture)
      stopRecognition();
      setState('processing');

      callbacks.onMessage(transcript, null, false);
      messageHistory.push({ role: 'user', parts: [{ text: transcript }] });
      
      // ponytail: keep only last 4 turns to prevent context bloat in voice mode
      if (messageHistory.length > 8) {
        messageHistory.splice(0, messageHistory.length - 8);
      }

      try {
        const aiStream = sendMessageToGemini(transcript, messageHistory, false, language, undefined, customGreeting, brandId, true);
        let fullResponse = '';
        for await (const chunk of aiStream) {
          const chunkText = typeof chunk === 'string' ? chunk : ((chunk as any)?.text || '');
          fullResponse += chunkText;
        }

        if (!fullResponse) fullResponse = language === 'en' ? 'I apologize, could you repeat that?' : 'Disculpa, ¿podrías repetirlo?';

        callbacks.onMessage(fullResponse, null, false);
        messageHistory.push({ role: 'model', parts: [{ text: fullResponse }] });

        // TTS phase — recognition is already stopped, no echo risk
        setState('speaking');
        const ttsModel = language === 'en' ? 'aura-asteria-en' : 'aura-2-celeste-es';

        await speakTextWithDeepgram(fullResponse, ttsModel, language);

        // TTS done — resume listening
        if (isRecording && voiceState !== 'stopped') {
          setState('idle');
          safeStartRecognition();
        }
      } catch (err: any) {
        console.error('Voice processing error:', err);
        callbacks.onError(err);
        // Self-heal: go back to listening
        if (isRecording && voiceState !== 'stopped') {
          setState('idle');
          setTimeout(() => safeStartRecognition(), 1000);
        }
      }
    };

    recognition.onerror = (event: any) => {
      const errType = event?.error || '';
      console.warn('Speech recognition error:', errType);

      if (errType === 'not-allowed' || errType === 'service-not-allowed') {
        callbacks.onError(new Error('Microphone permission denied.'));
        return; // Don't retry — permission issue
      }

      // 'no-speech' is normal during silence — don't treat as error, just restart
      if (errType === 'no-speech' || errType === 'aborted') {
        if (isRecording && voiceState === 'listening') {
          setTimeout(() => safeStartRecognition(), 300);
        }
        return;
      }

      // Network or unknown error — retry with backoff
      if (isRecording && voiceState !== 'stopped' && voiceState !== 'speaking') {
        setState('idle');
        setTimeout(() => safeStartRecognition(), 1000);
      }
    };

    recognition.onend = () => {
      // Recognition ended (timeout or manual) — auto-restart if still recording
      if (isRecording && voiceState !== 'stopped' && voiceState !== 'speaking' && voiceState !== 'processing') {
        setState('idle');
        setTimeout(() => safeStartRecognition(), 200);
      }
    };

    // Initial greeting
    const greeting = customGreeting || (language === 'en'
      ? 'Hello! How can I help you today?'
      : brandId === 'unitec' ? '¡Hola! Bienvenido a UNITEC USA DESIGN.' : '¡Hola! Bienvenido a Building Innovation.');

    setTimeout(() => {
      callbacks.onMessage(greeting, null, false);
      messageHistory.push({ role: 'model', parts: [{ text: greeting }] });

      setState('speaking');
      const ttsModel = language === 'en' ? 'aura-asteria-en' : 'aura-2-celeste-es';

      speakTextWithDeepgram(greeting, ttsModel, language).then(() => {
        if (isRecording && voiceState !== 'stopped') {
          setState('idle');
          safeStartRecognition();
        }
      }).catch(() => {
        // TTS failed — still start listening
        if (isRecording && voiceState !== 'stopped') {
          setState('idle');
          safeStartRecognition();
        }
      });
    }, 800);

  } else {
    setTimeout(() => callbacks.onError(new Error('Web Speech API not supported. Please use Chrome or Edge.')), 100);
  }

  return {
    disconnect: async () => {
      isRecording = false;
      setState('stopped');
      stopRecognition();
      try { window.speechSynthesis?.cancel(); } catch (_) {}
      callbacks.onClose();
    },
    getAudioBlob: () => new Blob(),
    stream: null as any
  };
};

// ─── Utility stubs (keep for import compatibility) ────────────────────────────
export async function generateConversationSummary(messages: any[], brandId = 'building') {
  return { summary: 'Conversation ended.', qaPairs: [] };
}
export async function generateEmbedding(text: string) { return null; }
