// geminiService.ts handles interactions with the Google GenAI SDK and the secure Server-side Proxy
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { getSystemInstruction, TOOLS } from "../constants";
import { decodeAudioData, decode, encode, pcmToWavBlob } from "../utils/audioUtils";
import { Language, VoiceName } from "../types";
import { trackUsage } from "./usageService";

// Helper for stateless reset
export const resetChatSession = () => {
  // Stateless implementation doesn't require reset, but keeping for compatibility
};

const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
  }
  return 'https://unitecusadesign.com';
};

/**
 * Text-to-speech using Gemini 2.5 Flash TTS model via Secure Server-side Proxy.
 */
export async function playGeminiTTS(text: string, voiceName: string = 'Kore') {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/API/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          generationConfig: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName as any },
              },
            },
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`TTS Proxy Error: ${response.statusText}`);
    }

    const data = await response.json();
    const base64Audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        audioContext,
        24000,
        1
      );
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
      
      return new Promise<void>((resolve) => {
        source.onended = () => {
          audioContext.close();
          resolve();
        };
      });
    }
  } catch (error) {
    console.error("TTS generation failed:", error);
  }
}

/**
 * Sends a message to Gemini using the generateContentStream API via Secure Server-side Proxy.
 */
export async function* sendMessageToGemini(
  message: string,
  history: { role: 'user' | 'model', parts: { text: string }[] }[] = [],
  emergencyMode: boolean = false,
  language: Language = 'en',
  onToolSuccess?: (toolName: string, result: any) => void,
  customGreeting?: string,
  brandId: 'unitec' | 'building' = 'unitec'
) {
  let instructions = getSystemInstruction(language, customGreeting, brandId);
  if (emergencyMode) {
    instructions += "\n\n[SYSTEM OVERRIDE: EMERGENCY MODE ACTIVE]. Respond concisely. Prioritize safety protocols immediately.";
  }

  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/API/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemini-3-flash-preview',
      contents: [...history, { role: 'user', parts: [{ text: message }] }],
      isStream: true,
      config: {
        systemInstruction: instructions,
        tools: [{ functionDeclarations: TOOLS }],
      }
    })
  });

  if (!response.ok) {
    throw new Error(`AI Proxy stream error: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Stream reader not available");

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const cleanLine = line.replace(/^data:\s*/, '').trim();
      if (!cleanLine) continue;

      try {
        const chunk = JSON.parse(cleanLine);
        
        if (chunk.usageMetadata) {
          const totalTokens = chunk.usageMetadata.totalTokenCount;
          trackUsage({
            totalTokens: totalTokens,
            chatTokens: totalTokens,
            apiCalls: 1
          });
        }

        const part = chunk.candidates?.[0]?.content?.parts?.find((p: any) => p.functionCall);
        if (part && part.functionCall && part.functionCall.name) {
          if (onToolSuccess) {
            onToolSuccess(part.functionCall.name, part.functionCall.args);
          }
        }

        yield chunk;
      } catch (e) {
        // Partial chunk, wait for more data
      }
    }
  }
}

/**
 * Generates embeddings for the given text using Gemini Embedding 2 via Secure Proxy.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/API/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-embedding-2-preview',
        contents: [text]
      })
    });
    
    if (!response.ok) throw new Error("Embedding fetch failed");
    const result = await response.json();
    if (result.embeddings && result.embeddings.length > 0 && result.embeddings[0].values) {
      trackUsage({ apiCalls: 1 });
      return result.embeddings[0].values;
    }
    return null;
  } catch (error) {
    console.error("Error generating embedding:", error);
    return null;
  }
}

// --- Live API (Voice & Vision) Service ---
// Uses direct connection as WebSocket requires client-side handshake

export interface LiveSessionCallbacks {
  onOpen: () => void;
  onMessage: (text: string | null, audioBuffer: AudioBuffer | null, isInterrupted: boolean) => void;
  onAudioData: (data: Uint8Array) => void; 
  onError: (error: Error) => void;
  onClose: () => void;
  onToolCall: (toolName: string) => void;
  onToolSuccess?: (toolName: string, result: any) => void;
}

export const connectLiveSession = async (
    callbacks: LiveSessionCallbacks, 
    emergencyMode: boolean = false, 
    language: Language = 'en',
    voiceName: VoiceName = 'Kore',
    customGreeting?: string,
    brandId: 'unitec' | 'building' = 'unitec'
) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey: apiKey as string });
  const startTime = Date.now();

  const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
  const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  
  const analyser = outputAudioContext.createAnalyser();
  analyser.fftSize = 64; 
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.connect(outputAudioContext.destination);

  const visualizerInterval = setInterval(() => {
    analyser.getByteFrequencyData(dataArray);
    callbacks.onAudioData(new Uint8Array(dataArray));
  }, 50);

  let nextStartTime = 0;
  const sources = new Set<AudioBufferSourceNode>();
  const audioChunks: Uint8Array[] = [];
  
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ 
      audio: true
    });
  } catch (err) {
    callbacks.onError(new Error("MIC_NOT_FOUND"));
    return null;
  }

  await inputAudioContext.resume();
  await outputAudioContext.resume();

  let instructions = getSystemInstruction(language, customGreeting, brandId);
  
  if (emergencyMode) {
    instructions += "\n\n[SYSTEM OVERRIDE: EMERGENCY MODE ACTIVE]. Respond concisely.";
  }

  const sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    callbacks: {
      onopen: () => {
        callbacks.onOpen();
        const source = inputAudioContext.createMediaStreamSource(stream);
        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
        scriptProcessor.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            int16[i] = inputData[i] * 32768;
          }
          const pcmData = encode(new Uint8Array(int16.buffer));
          sessionPromise.then(s => s.sendRealtimeInput({ audio: { mimeType: 'audio/pcm;rate=16000', data: pcmData } }));
        };
        source.connect(scriptProcessor);
        scriptProcessor.connect(inputAudioContext.destination);

        const greetPrompt = customGreeting 
          ? `¡Hola! Por favor salúdame inmediatamente con nuestro saludo personalizado de la empresa en español: "${customGreeting}"`
          : (language === 'en' 
            ? "Hello! Please greet me now cordially, introduce yourself as the front desk coordinator of UNITEC Design." 
            : "¡Hola! Por favor salúdame con mucho entusiasmo ahora mismo en español, dándome la bienvenida a UNITEC Design.");

        sessionPromise.then(s => {
          s.sendClientContent({
            turns: [{
              role: 'user',
              parts: [{ text: greetPrompt }]
            }],
            turnComplete: true
          });
        });
      },
      onmessage: async (message: LiveServerMessage) => {
        const parts = message.serverContent?.modelTurn?.parts;
        const base64Audio = parts?.find(p => p.inlineData)?.inlineData?.data;

        const modelTranscript = parts?.find(p => p.text)?.text;
        const userTranscript = (message.serverContent as any)?.userContent?.parts?.find((p: any) => p.text)?.text;
        
        if (modelTranscript || userTranscript) {
          callbacks.onMessage(modelTranscript || userTranscript || null, null, false);
        }

        if (base64Audio) {
            const audioData = decode(base64Audio);
            audioChunks.push(audioData);
            nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
            const audioBuffer = await decodeAudioData(audioData, outputAudioContext, 24000, 1);
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(analyser); 
            source.start(nextStartTime);
            nextStartTime += audioBuffer.duration;
            sources.add(source);
            source.onended = () => sources.delete(source);
        }

        if (message.serverContent?.interrupted) {
          for (const source of sources.values()) {
            try { source.stop(); } catch(e) {}
            sources.delete(source);
          }
          nextStartTime = 0;
        }

        if (message.toolCall && message.toolCall.functionCalls) {
          for (const fc of message.toolCall.functionCalls) {
            if (fc.name) {
                callbacks.onToolCall(fc.name);
                if (callbacks.onToolSuccess) {
                  callbacks.onToolSuccess(fc.name, { status: 'success', ...fc.args });
                }
                sessionPromise.then(s => s.sendToolResponse({
                  functionResponses: [{
                    id: fc.id || '',
                    name: fc.name || '',
                    response: { result: "ok" }
                  }]
                }));
            }
          }
        }
        callbacks.onMessage(null, null, !!message.serverContent?.interrupted);
      },
      onerror: (e) => {
        console.error("Live API Error:", e);
        callbacks.onError(new Error("CONNECTION_ERROR"));
      },
      onclose: () => {
        const durationMin = (Date.now() - startTime) / 60000;
        trackUsage({ minutesUsed: durationMin, apiCalls: 1 });
        callbacks.onClose();
        clearInterval(visualizerInterval);
      }
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName as any } }
      },
      systemInstruction: instructions,
      tools: [{ functionDeclarations: TOOLS }],
      outputAudioTranscription: {},
    }
  });

  return {
    disconnect: async () => {
      clearInterval(visualizerInterval);
      sessionPromise.then(s => s.close());
      if (stream) stream.getTracks().forEach(t => t.stop());
      inputAudioContext.close();
      outputAudioContext.close();
    },
    getAudioBlob: () => pcmToWavBlob(audioChunks, 24000),
    stream
  };
};

