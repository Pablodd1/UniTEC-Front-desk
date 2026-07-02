// @ts-nocheck\nï»¿
// geminiService.ts handles interactions with the Google GenAI SDK
import { GoogleGenAI, LiveServerMessage, Modality, GenerateContentResponse } from "@google/genai";
import { getSystemInstruction, TOOLS, PRODUCTS } from "../constants";
import { decodeAudioData, decode, encode, pcmToWavBlob } from "../utils/audioUtils";
import { Language, VoiceName } from "../types";
import { trackUsage } from "./usageService";



// EMERGENCY OVERRIDE: Using OpenRouter / OpenAI compatible API instead of Gemini
let cachedApiKey = '';
export async function getApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;

  const localKey = typeof window !== 'undefined' ? window.localStorage.getItem('unitec_gemini_api_key') : null;
  if (localKey) return localKey;
  try {
    const res = await fetch('/api/gemini-key');
    if (res.ok) {
      const data = await res.json();
      if (data.apiKey) {
        cachedApiKey = data.apiKey;
        return cachedApiKey;
      }
    }
  } catch (e) {}
  
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

export const resetApiKeyCache = (): void => {};
export const resetChatSession = () => {};

export async function playGeminiTTS(text: string, voiceName: string = 'Kore') {
  // TTS polyfill: we can just use Web Speech API here since we removed Gemini
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-ES';
  synth.speak(utterance);
  return new Promise(resolve => { utterance.onend = resolve; });
}

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
  let instructions = getSystemInstruction(language, customGreeting, brandId);
  if (emergencyMode) instructions += "\n\n[SYSTEM OVERRIDE: EMERGENCY MODE ACTIVE]. Respond concisely.";

  // Convert Gemini history format to OpenAI format
  const messages = [
    { role: 'system', content: instructions },
    ...history.map(h => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.parts?.[0]?.text || ''
    }))
  ];
  
  if (message) {
    messages.push({ role: 'user', content: message });
  }

  // Use OpenRouter endpoint (or OpenAI if key starts with sk-)
  const isGemini = apiKey.startsWith('AIza');
  const isOpenAI = apiKey.startsWith('sk-') && !apiKey.startsWith('sk-or-');
  
  if (isGemini) {
    // Fallback to Gemini REST API since SDK was removed
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${apiKey}`;
    
    // Convert to Gemini format
    const geminiContents = [
      { role: 'user', parts: [{ text: "System Instructions: " + instructions }] },
      ...history.map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.parts?.[0]?.text || h.text || '' }]
      }))
    ];
    
    if (message) {
      geminiContents.push({ role: 'user', parts: [{ text: message }] });
    }

    const response = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: geminiContents })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Gemini API Error (${response.status}): ${errText}`);
    }

    // Simple JSON fallback for Gemini REST stream (it returns an array of JSON objects if not streamed properly, or SSE if using SSE)
    // Actually streamGenerateContent returns a JSON array stream but fetch doesn't easily parse it unless we do manual chunking
    const reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');
    if (!reader) throw new Error('Failed to get stream reader');

    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        // Gemini REST API streams an array of objects: [ { "candidates": ...
        // We will just try to extract the text from the buffer as it grows
        // For a robust emergency fix, we'll just yield the text as we find it
        // A simpler way: just wait for the whole thing (it's fast enough) or regex the parts.
        // But since it's a generator, we must yield.
      }
      
      // Since parsing Gemini's weird JSON stream is complex in an emergency patch, 
      // let's just parse the whole buffer at once to avoid stream chunking bugs.
      const json = JSON.parse(buffer);
      if (Array.isArray(json)) {
        for (const chunk of json) {
          const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
             yield { text, candidates: [{ content: { parts: [{ text }] } }] };
          }
        }
      }
    } catch (e) {
      // If JSON parse fails, it might be an error response
      console.error(e);
      throw new Error("Failed to parse Gemini response");
    }
    return;
  }

  // OpenRouter / OpenAI path
  const endpoint = isOpenAI ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
  const model = isOpenAI ? 'gpt-4o-mini' : 'openai/gpt-4o-mini';

  let response;
  let lastError;
  const maxRetries = 3;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': Bearer \,
          'Content-Type': 'application/json',
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.href : 'http://localhost:5173',
          'X-Title': 'Building Innovation Chatbot'
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          stream: true
        })
      });
      
      if (response.ok) break;
      
      const errText = await response.text().catch(() => '');
      lastError = new Error(API Error (\): \);
    } catch (err) {
      lastError = err;
    }
    
    if (attempt < maxRetries - 1) {
      // Exponential backoff: 1s, 2s
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }

  if (!response || !response.ok) {
    throw lastError || new Error("Failed to connect after retries");
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
        
        // Gemini REST API streams an array of objects: [ { "candidates": ...
        // We will just try to extract the text from the buffer as it grows
        // For a robust emergency fix, we'll just yield the text as we find it
        // A simpler way: just wait for the whole thing (it's fast enough) or regex the parts.
        // But since it's a generator, we must yield.
      }
      
      // Since parsing Gemini's weird JSON stream is complex in an emergency patch, 
      // let's just parse the whole buffer at once to avoid stream chunking bugs.
      const json = JSON.parse(buffer);
      if (Array.isArray(json)) {
        for (const chunk of json) {
          const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
             yield { text, candidates: [{ content: { parts: [{ text }] } }] };
          }
        }
      }
    } catch (e) {
      // If JSON parse fails, it might be an error response
      console.error(e);
      throw new Error("Failed to parse Gemini response");
    }
    return;
  }

  // OpenRouter / OpenAI path
  const endpoint = isOpenAI ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
  const model = isOpenAI ? 'gpt-4o-mini' : 'openai/gpt-4o-mini';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.href : 'http://localhost:5173',
      'X-Title': 'Building Innovation Chatbot'
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      stream: true
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`API Error (${response.status}): ${errText}`);
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
          } catch (e) {}
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export const connectLiveSession = async (
    callbacks: any, 
    emergencyMode: boolean = false, 
    language: any = 'es',
    voiceName: string = 'Kore',
    customGreeting?: string,
    brandId: any = 'building'
) => {
  // Web Speech API + OpenRouter Voice Fallback
  let isRecording = true;
  let recognition: any = null;
  let synth = window.speechSynthesis;
  let messageHistory: any[] = [];
  let instructions = getSystemInstruction(language, customGreeting, brandId);
  
  // Request microphone permission explicitly so browser shows permission dialog
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
  } catch (permErr) {
    callbacks.onError(new Error("Microphone permission denied. Please allow access and try again."));
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
      messageHistory.push({ role: 'user', parts: [{text: transcript}] });
      
      try {
        const stream = sendMessageToGemini(transcript, messageHistory, false, language, undefined, customGreeting, brandId);
        let fullResponse = '';
        for await (const chunk of stream) {
           fullResponse += chunk.text || '';
        }
        
        callbacks.onMessage(fullResponse, null, false);
        messageHistory.push({ role: 'model', parts: [{text: fullResponse}] });
        
        const utterance = new SpeechSynthesisUtterance(fullResponse);
        utterance.lang = language === 'en' ? 'en-US' : 'es-ES';
        utterance.onend = () => { if (isRecording && recognition) recognition.start(); };
        setTimeout(() => { if (isRecording && !synth.speaking && recognition) { try { recognition.start(); } catch(e) {} } }, 3000);
        synth.speak(utterance);
        
      } catch (err: any) {
        callbacks.onError(err);
      }
    };
    
    recognition.onerror = (e: any) => {
      if (isRecording) {
         setTimeout(() => { if (isRecording && recognition) recognition.start(); }, 1000);
      }
    };
    
    recognition.onend = () => {
       if (isRecording && !synth.speaking) recognition.start();
    };
    
    setTimeout(() => {
        const greeting = customGreeting || (language === "en" ? "Hello! How can I help you today?" : (brandId === "unitec" ? "Â¡Hola! Bienvenido a UNITEC USA DESIGN." : "Â¡Hola! Bienvenido a Building Innovation."));
        callbacks.onMessage(greeting, null, false);
        messageHistory.push({ role: 'model', parts: [{text: greeting}] });
        const utterance = new SpeechSynthesisUtterance(greeting);
        utterance.lang = language === 'en' ? 'en-US' : 'es-ES';
        utterance.onend = () => { if (isRecording) recognition.start(); };
        setTimeout(() => { if (isRecording && !synth.speaking && recognition) { try { recognition.start(); } catch(e) {} } }, 3000);
        synth.speak(utterance);
    }, 1000);
    
  } else {
    setTimeout(() => callbacks.onError(new Error("Web Speech API not supported in this browser.")), 100);
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

export async function generateConversationSummary(messages: any[], brandId = 'building') {
  return { summary: "Conversation ended.", qaPairs: [] };
}
export async function generateEmbedding(text: string) { return null; }

