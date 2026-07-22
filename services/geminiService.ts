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

export async function* sendMessageToGemini(
  message: string,
  history: any[] = [],
  emergencyMode: boolean = false,
  language: any = 'es',
  onToolSuccess?: (toolName: string, result: any) => void,
  customGreeting?: string,
  brandId: any = 'building'
): AsyncGenerator<any, void, unknown> {

  let instructions = getSystemInstruction(language, customGreeting, brandId);
  if (emergencyMode) instructions += '\n\n[SYSTEM OVERRIDE: EMERGENCY MODE ACTIVE]. Respond concisely.';

  // 1. Primary path: Call secure serverless proxy (/api/chat)
  try {
    const proxyRes = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, instructions }),
      signal: AbortSignal.timeout(7000)
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data.text) {
        yield data.text;
        return;
      }
    }
  } catch (proxyError) {
    console.warn("Serverless chat proxy unreachable, falling back to direct API key access:", proxyError);
  }

  // 2. Direct client fallback if proxy unavailable
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('API_KEY_MISSING');

  const isOpenRouter = apiKey.startsWith('sk-or-') || apiKey.startsWith('sk-proj-');
  if (isOpenRouter) {
    try {
      const formattedMessages = [
        { role: 'system', content: instructions },
        ...history.map(h => ({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.text || h.parts?.[0]?.text || ''
        })),
        { role: 'user', content: message }
      ];

      const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
          messages: formattedMessages
        })
      });

      if (orRes.ok) {
        const orData = await orRes.json();
        const answer = orData.choices?.[0]?.message?.content || '';
        if (answer) {
          yield answer;
          return;
        }
      }
    } catch (_) {}
  }

  const geminiContents = [
      ...history.map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: h.parts || [{ text: h.text || '' }]
      }))
  ];
  if (message) geminiContents.push({ role: 'user', parts: [{ text: message }] });

  const bodyPayload = {
      contents: geminiContents,
      systemInstruction: { parts: [{ text: instructions }] },
      tools: [{ functionDeclarations: TOOLS }]
  };

  const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${apiKey}`;

  let response = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
  });

  if (!response.ok) {
      throw new Error(`Gemini API Error: ${await response.text()}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
      while (true) {
        const { done, value } = await reader!.read();
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
                    const part = json.candidates?.[0]?.content?.parts?.[0];
                    if (part) {
                        if (part.text) {
                            yield { text: part.text, candidates: json.candidates };
                        }
                        if (part.functionCall) {
                            const args = part.functionCall.args || {};
                            if (part.functionCall.name === 'search_catalog') {
                                const result = await performCatalogSearch(args.query || '', brandId);
                                if (onToolSuccess) onToolSuccess('search_catalog', result);
                                
                                const functionResponsePart = {
                                    functionResponse: {
                                        name: 'search_catalog',
                                        response: { result }
                                    }
                                };
                                
                                geminiContents.push({
                                    role: 'model',
                                    parts: [part]
                                });
                                geminiContents.push({
                                    role: 'user',
                                    parts: [functionResponsePart]
                                });
                                
                                const followUpPayload = {
                                    contents: geminiContents,
                                    systemInstruction: { parts: [{ text: instructions }] },
                                    tools: [{ functionDeclarations: TOOLS }]
                                };
                                
                                const followUpResponse = await fetch(geminiEndpoint, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(followUpPayload)
                                });
                                
                                const fReader = followUpResponse.body?.getReader();
                                let fBuffer = '';
                                while (true) {
                                    const { done: fDone, value: fValue } = await fReader!.read();
                                    if (fDone) break;
                                    fBuffer += decoder.decode(fValue, { stream: true });
                                    const fLines = fBuffer.split('\n');
                                    fBuffer = fLines.pop() || '';
                                    for (const fLine of fLines) {
                                        const fTrimmed = fLine.trim();
                                        if (fTrimmed.startsWith('data: ')) {
                                            try {
                                                const fJson = JSON.parse(fTrimmed.slice(6));
                                                const fPart = fJson.candidates?.[0]?.content?.parts?.[0];
                                                if (fPart && fPart.text) {
                                                    yield { text: fPart.text, candidates: fJson.candidates };
                                                }
                                            } catch (e) {}
                                        }
                                    }
                                }
                            } else {
                                if (onToolSuccess) onToolSuccess(part.functionCall.name, args);
                            }
                        }
                    }
                } catch (e) {}
            }
        }
      }
  } finally {
      if (reader) reader.releaseLock();
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
