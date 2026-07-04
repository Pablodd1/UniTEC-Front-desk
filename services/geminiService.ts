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
export const resetChatSession = () => {};

// ─── TTS ────────────────────────────────────────────────────────────────────
export async function playGeminiTTS(text: string, voiceName: string = 'Kore') {
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-ES';
  synth.speak(utterance);
  return new Promise(resolve => { utterance.onend = resolve; });
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const RETRY_DELAYS = [1000, 2000]; // ms between attempts 1→2 and 2→3

// ─── Main chat generator ────────────────────────────────────────────────────
export async function* sendMessageToGemini(
  message: string,
  history: any[] = [],
  emergencyMode: boolean = false,
  language: any = 'es',
  onToolSuccess?: (toolName: string, result: any) => void,
  customGreeting?: string,
  brandId: any = 'building'
): AsyncGenerator<any, void, unknown> {

  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }

  let instructions = getSystemInstruction(language, customGreeting, brandId);
  if (emergencyMode) instructions += '\n\n[SYSTEM OVERRIDE: EMERGENCY MODE ACTIVE]. Respond concisely.';

  // ── Gemini REST path (if key starts with AIza) ───────────────────────────
  const isGemini = apiKey.startsWith('AIza');

  if (isGemini) {
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${apiKey}`;

    const geminiContents = [
      { role: 'user', parts: [{ text: 'System Instructions: ' + instructions }] },
      ...history.map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.parts?.[0]?.text || h.text || '' }]
      }))
    ];
    if (message) geminiContents.push({ role: 'user', parts: [{ text: message }] });

    const response = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: geminiContents })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Gemini API Error (${response.status}): ${errText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');
    if (!reader) throw new Error('Failed to get stream reader');

    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
      }
      const json = JSON.parse(buffer);
      if (Array.isArray(json)) {
        for (const chunk of json) {
          const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield { text, candidates: [{ content: { parts: [{ text }] } }] };
        }
      }
    } catch (e) {
      console.error('Gemini parse error:', e);
      throw new Error('Failed to parse Gemini response');
    } finally {
      reader.releaseLock();
    }
    return;
  }

  // ── OpenRouter / OpenAI path ─────────────────────────────────────────────
  const isOpenAI = apiKey.startsWith('sk-') && !apiKey.startsWith('sk-or-');
  const endpoint = isOpenAI
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions';
  const model = isOpenAI ? 'gpt-4o-mini' : 'openai/gpt-4o-mini';

  const messages = [
    { role: 'system', content: instructions },
    ...history.map(h => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.parts?.[0]?.text || ''
    }))
  ];
  if (message) messages.push({ role: 'user', content: message });

  // 3-attempt retry with exponential backoff
  let response: Response | undefined;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.href : 'https://unitec-front-desk.vercel.app',
          'X-Title': 'UNITEC Chatbot'
        },
        body: JSON.stringify({ model, messages, stream: true })
      });

      if (response.ok) break; // success — exit retry loop

      const errText = await response.text().catch(() => '');
      lastError = new Error(`API Error (${response.status}): ${errText}`);
    } catch (err: any) {
      lastError = err;
      response = undefined;
    }

    if (attempt < 2) await sleep(RETRY_DELAYS[attempt]);
  }

  if (!response || !response.ok) {
    throw lastError || new Error('Failed to connect to AI after 3 attempts');
  }

  // ── SSE stream parsing ───────────────────────────────────────────────────
  const reader = response.body?.getReader();
  const decoder = new TextDecoder('utf-8');
  if (!reader) throw new Error('Failed to get stream reader');

  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            const chunkText = json.choices?.[0]?.delta?.content || '';
            if (chunkText) {
              yield {
                text: chunkText,
                candidates: [{ content: { parts: [{ text: chunkText }] } }]
              };
            }
          } catch (_) { /* skip malformed SSE chunk */ }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── Voice / Live Session ────────────────────────────────────────────────────
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
  const synth = window.speechSynthesis;
  const messageHistory: any[] = [];
  const instructions = getSystemInstruction(language, customGreeting, brandId);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
  } catch {
    callbacks.onError(new Error('Microphone permission denied. Please allow access and try again.'));
    return { disconnect: async () => {}, getAudioBlob: () => new Blob(), stream: null };
  }

  setTimeout(() => callbacks.onOpen(), 100);

  if ('webkitSpeechRecognition' in window) {
    recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language === 'en' ? 'en-US' : 'es-ES';

    recognition.onstart = () => {
      const interval = setInterval(() => {
        if (!isRecording) clearInterval(interval);
        if (callbacks.onAudioData) callbacks.onAudioData(new Uint8Array(64).fill(128));
      }, 100);
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      callbacks.onMessage(transcript, null, false);
      messageHistory.push({ role: 'user', parts: [{ text: transcript }] });

      try {
        const stream = sendMessageToGemini(transcript, messageHistory, false, language, undefined, customGreeting, brandId);
        let fullResponse = '';
        for await (const chunk of stream) { fullResponse += chunk.text || ''; }

        callbacks.onMessage(fullResponse, null, false);
        messageHistory.push({ role: 'model', parts: [{ text: fullResponse }] });

        const utterance = new SpeechSynthesisUtterance(fullResponse);
        utterance.lang = language === 'en' ? 'en-US' : 'es-ES';
        utterance.onend = () => { if (isRecording && recognition) recognition.start(); };
        setTimeout(() => { if (isRecording && !synth.speaking && recognition) { try { recognition.start(); } catch (_) {} } }, 3000);
        synth.speak(utterance);
      } catch (err: any) {
        callbacks.onError(err);
      }
    };

    recognition.onerror = () => {
      if (isRecording) setTimeout(() => { if (isRecording && recognition) recognition.start(); }, 1000);
    };

    recognition.onend = () => {
      if (isRecording && !synth.speaking) recognition.start();
    };

    const greeting = customGreeting || (language === 'en'
      ? 'Hello! How can I help you today?'
      : brandId === 'unitec' ? '¡Hola! Bienvenido a UNITEC USA DESIGN.' : '¡Hola! Bienvenido a Building Innovation.');

    setTimeout(() => {
      callbacks.onMessage(greeting, null, false);
      messageHistory.push({ role: 'model', parts: [{ text: greeting }] });
      const utterance = new SpeechSynthesisUtterance(greeting);
      utterance.lang = language === 'en' ? 'en-US' : 'es-ES';
      utterance.onend = () => { if (isRecording) recognition.start(); };
      setTimeout(() => { if (isRecording && !synth.speaking && recognition) { try { recognition.start(); } catch (_) {} } }, 3000);
      synth.speak(utterance);
    }, 1000);

  } else {
    setTimeout(() => callbacks.onError(new Error('Web Speech API not supported in this browser.')), 100);
  }

  return {
    disconnect: async () => {
      isRecording = false;
      if (recognition) recognition.stop();
      if (synth) synth.cancel();
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
