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

import { speakTextWithDeepgram, transcribeAudioWithDeepgram } from './deepgramService';
import { triggerEscalation } from './notificationService';
import { updateSessionStatus } from './conversationService';

// Espejo de api/turn-text.js (STAFF_WORDS + QUOTE_WORDS) para la llamada de voz — MANTENER EN SYNC.
// En texto, pedir un asesor avisa al equipo; antes la voz NO lo hacía (paridad 2026-10-18).
const VOICE_ESCALATION_WORDS = ['asesor', 'humano', 'human', 'agente', 'agent', 'staff', 'llamar',
  'call me', 'speak to someone', 'talk to someone', 'hablar con alguien', 'hablar con una persona',
  'persona real', 'ejecutivo', 'vendedor', 'representante', 'comunicame', 'comunícame',
  'me contacte', 'me contacten', 'que me llame', 'que me llames',
  'urgente', 'urgencia', 'emergencia', 'cotiz', 'presupuesto', 'quote', 'budget'];

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

// Paridad voz/texto: si un asesor ya tomó la conversación, la IA de voz TAMPOCO responde
// (antes la voz seguía contestando por encima del humano). ChatTab mantiene esto al día.
let voiceTakeoverReason = '';
export const setVoiceTakeover = (reason: string) => { voiceTakeoverReason = reason || ''; };

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
          // Canal del turno: permite auditar/evaluar voz y texto por separado (antes todo era 'web').
          channel: isVoiceMode ? 'voice' : 'text',
          parentHost: typeof document !== 'undefined' ? (document.referrer || '') : '',
          stream: true,
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

      if (proxyRes.status === 409) {
        // Duplicate of a request that is still being processed (double-click).
        // The first request's reply is already on its way to this chat — end silently.
        return;
      }

      if (proxyRes.ok) {
        const contentType = proxyRes.headers.get('content-type') || '';
        if (contentType.includes('text/event-stream') && proxyRes.body) {
          // ── Streaming (SSE): yield each delta as it arrives so the bubble fills live ──
          const reader = proxyRes.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let gotAny = false;
          let acc = '';
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const parts = buffer.split('\n\n');
              buffer = parts.pop() || '';
              for (const part of parts) {
                const dataLine = part.split('\n').find(l => l.startsWith('data:'));
                if (!dataLine) continue;
                let evt: any;
                try { evt = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }
                if (evt.delta) { gotAny = true; acc += evt.delta; yield evt.delta; }
                if (evt.done) {
                  // The server may send a cleaned final text (capped replies are trimmed
                  // to a clean sentence ending). Replace what is on screen if it differs.
                  if (evt.text && evt.text !== acc) yield { replace: String(evt.text) };
                  return;
                }
              }
            }
          } catch (streamErr) {
            if (gotAny) return; // keep the partial reply on screen; no error bubble mid-stream
            throw streamErr;
          }
          if (gotAny) return;
          lastProxyError = new Error('EMPTY_STREAM');
          if (attempt === 0) continue;
          throw new Error('PROXY_UNREACHABLE');
        }
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
  brandId: any = 'building',
  sessionId: string = ''
) => {
  let isRecording = true;
  let voiceEscalated = false;
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

  // ── Pipeline único del turno de voz (lo usan los DOS motores de STT) ─────────
  // 2026-10-18: antes este bloque vivía dentro de recognition.onresult, así que la voz sólo
  // existía si el navegador tiene Web Speech (Chrome/Edge). En Safari/iOS, Firefox o cuando el
  // servicio de voz de Chrome falla, la llamada moría. Ahora ambos motores llaman aquí, y el
  // texto del cliente también se reporta con rol 'user' (antes se pintaba como si fuera del bot).
  const runVoiceTurn = async (transcript: string) => {
    if (!transcript) return;

    if (voiceTakeoverReason) {
      // Mismo contrato que el chat de texto: se registra el turno, pero contesta el humano.
      callbacks.onMessage(voiceTakeoverReason, null, true, 'model');
      setState('idle');
      resumeListening();
      return;
    }

    callbacks.onMessage(transcript, null, false, 'user');

    // ── Paridad con el chat de texto: pedir un asesor/cotización despierta al equipo ──
    // (una vez por llamada; mismo detector que api/turn-text.js).
    if (!voiceEscalated && sessionId) {
      const low = transcript.toLowerCase();
      if (VOICE_ESCALATION_WORDS.some((kw) => low.includes(kw))) {
        voiceEscalated = true;
        const isQuote = /cotiz|presupuesto|quote|budget/.test(low);
        triggerEscalation({
          type: isQuote ? 'quote' : 'staff',
          priority: 'high',
          message: transcript,
          brand: brandId || 'unitec',
          sessionId,
          transcript: messageHistory.slice(-6),
          pageUrl: typeof window !== 'undefined' ? window.location.href : '',
          waitingSince: new Date().toISOString(),
        }).catch(console.error);
        updateSessionStatus(sessionId, 'human_requested', undefined, {
          escalationType: isQuote ? 'quote' : 'staff',
        }).catch(() => {});
        callbacks.onMessage(
          language === 'en'
            ? '✅ I let our team know — an advisor will write to you shortly.'
            : '✅ Ya avisé a un asesor del equipo: te escribirá por aquí en breve.',
          null, false, 'model'
        );
      }
    }

    messageHistory.push({ role: 'user', parts: [{ text: transcript }] });

    // ponytail: mismo criterio que el chat — el servidor recorta el historial; la voz ya no
    // olvida a los 4 turnos (antes 8 entradas), así que puede hilar una conversación larga.
    if (messageHistory.length > 24) {
      messageHistory.splice(0, messageHistory.length - 24);
    }

    try {
      const aiStream = sendMessageToGemini(transcript, messageHistory, false, language, undefined, customGreeting, brandId, true);
      let fullResponse = '';
      for await (const chunk of aiStream) {
        const chunkText = typeof chunk === 'string' ? chunk : ((chunk as any)?.text || '');
        fullResponse += chunkText;
      }

      if (!fullResponse) fullResponse = language === 'en' ? 'I apologize, could you repeat that?' : 'Disculpa, ¿podrías repetirlo?';

      callbacks.onMessage(fullResponse, null, false, 'model');
      messageHistory.push({ role: 'model', parts: [{ text: fullResponse }] });

      // TTS phase — no hay micrófono escuchando, no hay riesgo de eco
      setState('speaking');
      const ttsModel = language === 'en' ? 'aura-asteria-en' : 'aura-2-celeste-es';
      await speakTextWithDeepgram(fullResponse, ttsModel, language);

      if (isRecording && voiceState !== 'stopped') {
        setState('idle');
        resumeListening();
      }
    } catch (err: any) {
      console.error('Voice processing error:', err);
      callbacks.onError(err);
      if (isRecording && voiceState !== 'stopped') {
        setState('idle');
        setTimeout(() => resumeListening(), 1000);
      }
    }
  };

  // Qué reanuda la escucha según el motor activo (Web Speech o MediaRecorder+Deepgram).
  let resumeListening: () => void = () => {};
  let serverSttActive = false;
  let serverStream: MediaStream | null = null;

  // ── Motor 2: MediaRecorder + /api/deepgram-stt ────────────────────────────────
  // Se usa cuando el navegador NO tiene Web Speech (Safari/iOS/Firefox) o cuando el servicio
  // de voz de Chrome falla (network / language-not-supported / service-not-allowed). VAD por RMS:
  // empieza a grabar cuando hay voz y corta tras ~1,1 s de silencio (máx 12 s por turno).
  const startServerSttLoop = async () => {
    if (serverSttActive) return;
    serverSttActive = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      serverStream = stream;
      const MR: any = (window as any).MediaRecorder;
      if (!MR) throw new Error('MediaRecorder no disponible en este navegador');
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
        .find((m) => (MR.isTypeSupported ? MR.isTypeSupported(m) : false)) || '';
      const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new Ctx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      let recorder: any = null;
      let chunks: Blob[] = [];
      let talking = false;
      let silenceSince = 0;
      let recordStart = 0;
      const RMS_THRESHOLD = 0.02;
      const SILENCE_MS = 1100;
      const MAX_MS = 12000;

      const stopRec = () => {
        try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch (_) {}
      };

      const startRec = () => {
        if (!isRecording || voiceState === 'stopped') return;
        chunks = [];
        try { recorder = new MR(stream, mime ? { mimeType: mime } : undefined); } catch (_) { return; }
        recorder.ondataavailable = (e: any) => { if (e.data && e.data.size) chunks.push(e.data); };
        recorder.onstop = async () => {
          const blob = new Blob(chunks, { type: mime || 'audio/webm' });
          talking = false;
          if (!blob.size || blob.size < 800) { setState('listening'); return; }
          setState('processing');
          const text = await transcribeAudioWithDeepgram(blob, language);
          if (text && text.trim().length > 1) {
            await runVoiceTurn(text.trim());
          } else {
            setState('listening');
          }
        };
        recorder.start();
        recordStart = Date.now();
        talking = true;
        setState('listening');
      };

      const tick = () => {
        if (!isRecording || voiceState === 'stopped') return;
        const busy = voiceState === 'speaking' || voiceState === 'processing';
        if (busy) {
          if (talking) stopRec(); // no grabar mientras el bot habla (eco)
        } else {
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);
          if (rms > RMS_THRESHOLD) {
            if (!talking) startRec();
            silenceSince = 0;
          } else if (talking) {
            if (!silenceSince) silenceSince = Date.now();
            if (Date.now() - silenceSince > SILENCE_MS || Date.now() - recordStart > MAX_MS) stopRec();
          }
        }
        requestAnimationFrame(tick);
      };

      resumeListening = () => {
        if (isRecording && voiceState !== 'stopped' && !talking) setState('listening');
      };
      setState('listening');
      tick();
    } catch (e: any) {
      callbacks.onError(new Error(
        language === 'en'
          ? `Microphone unavailable for the voice call (${e?.message || e}).`
          : `No se pudo acceder al micrófono para la llamada de voz (${e?.message || e}).`
      ));
    }
  };

  // Saludo hablado (común a los dos motores): se dice una vez y luego se empieza a escuchar.
  const speakGreeting = () => {
    const greeting = customGreeting || (language === 'en'
      ? 'Hello! How can I help you today?'
      : brandId === 'unitec' ? '¡Hola! Bienvenido a UNITEC USA DESIGN.' : '¡Hola! Bienvenido a Building Innovation.');
    setTimeout(() => {
      callbacks.onMessage(greeting, null, false, 'model');
      messageHistory.push({ role: 'model', parts: [{ text: greeting }] });
      setState('speaking');
      const ttsModel = language === 'en' ? 'aura-asteria-en' : 'aura-2-celeste-es';
      speakTextWithDeepgram(greeting, ttsModel, language).then(() => {
        if (isRecording && voiceState !== 'stopped') { setState('idle'); resumeListening(); }
      }).catch(() => {
        if (isRecording && voiceState !== 'stopped') { setState('idle'); resumeListening(); }
      });
    }, 800);
  };

  const hasWebSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  const SpeechRecognitionCtor = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

  if (hasWebSpeech && SpeechRecognitionCtor) {
    recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;    // Keep listening across multiple utterances
    recognition.interimResults = false; // Only final results to avoid partial triggers
    recognition.lang = language === 'en' ? 'en-US' : 'es-CO';
    recognition.maxAlternatives = 1;
    // Motor activo = Web Speech; si falla de forma dura, resumeListening se reasigna al servidor.
    resumeListening = () => safeStartRecognition();

    recognition.onstart = () => {
      setState('listening');
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
      // Un solo pipeline para los dos motores (ver runVoiceTurn arriba).
      await runVoiceTurn(transcript);
    };

    recognition.onerror = (event: any) => {
      const errType = event?.error || '';
      console.warn('Speech recognition error:', errType);

      // Fallo DURO del servicio de voz del navegador (Chrome sin red hacia Google, idioma sin
      // soporte, permiso denegado): no reintentar en bucle → cambiar al motor del servidor
      // (MediaRecorder + Deepgram), que no depende del navegador.
      if (['network', 'language-not-supported', 'service-not-allowed', 'not-allowed', 'audio-capture'].includes(errType)) {
        console.warn('[voice] Web Speech no disponible (' + errType + ') → cambiando a Deepgram STT');
        try { recognition.onend = null; } catch (_) {}
        stopRecognition();
        startServerSttLoop();
        return;
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
    speakGreeting();

  } else {
    // Sin Web Speech (Safari/iOS/Firefox, o WebView sin esa API): la llamada NO se cae;
    // se usa el motor del servidor (MediaRecorder + Deepgram) — mismo pipeline, mismo TTS.
    console.warn('[voice] Web Speech no disponible en este navegador → usando Deepgram STT');
    startServerSttLoop();
    speakGreeting();
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
