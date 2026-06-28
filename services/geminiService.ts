
// geminiService.ts handles interactions with the Google GenAI SDK
import { GoogleGenAI, LiveServerMessage, Modality, GenerateContentResponse } from "@google/genai";
import { getSystemInstruction, TOOLS, PRODUCTS } from "../constants";
import { decodeAudioData, decode, encode, pcmToWavBlob } from "../utils/audioUtils";
import { Language, VoiceName } from "../types";
import { trackUsage } from "./usageService";


let cachedApiKey: string | null = null;
export async function getApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;
  
  // 1. Try to load from localStorage (admin/local override)
  const localKey = typeof window !== 'undefined' ? window.localStorage.getItem('unitec_gemini_api_key') : null;
  if (localKey) {
    cachedApiKey = localKey;
    return localKey;
  }
  
  // 2. Fetch from runtime API endpoint
  try {
    const res = await fetch('/api/gemini-key');
    if (res.ok) {
      const data = await res.json();
      if (data.apiKey) {
        cachedApiKey = data.apiKey;
        return data.apiKey;
      }
    }
  } catch (e) {
    console.error("Failed to fetch API key from server:", e);
  }
  
  // 3. Fall back to build-time environment variable (safely, browser has no process.env)
  const buildTimeKey = (typeof process !== 'undefined' && process.env)
    ? (process.env.GEMINI_API_KEY || process.env.API_KEY || '')
    : '';
  return buildTimeKey;
}

let cachedGroqApiKey: string | null = null;
export async function getGroqApiKey(): Promise<string> {
  if (cachedGroqApiKey) return cachedGroqApiKey;
  
  const localKey = typeof window !== 'undefined' ? window.localStorage.getItem('unitec_groq_api_key') : null;
  if (localKey) {
    cachedGroqApiKey = localKey;
    return localKey;
  }
  
  try {
    const res = await fetch('/api/gemini-key');
    if (res.ok) {
      const data = await res.json();
      if (data.groqApiKey) {
        cachedGroqApiKey = data.groqApiKey;
      }
      if (data.apiKey) {
        cachedApiKey = data.apiKey;
      }
      if (cachedGroqApiKey) return cachedGroqApiKey;
    }
  } catch (e) {
    console.error("Failed to fetch Groq API key from server:", e);
  }
  
  const buildTimeKey = (typeof process !== 'undefined' && process.env)
    ? (process.env.XAI_API_KEY || process.env.GROK_API_KEY || process.env.GROQ_API_KEY || process.env.VITE_XAI_API_KEY || process.env.VITE_GROK_API_KEY || process.env.VITE_GROQ_API_KEY || '')
    : '';
  return buildTimeKey;
}

/** Reset cached API keys so next call re-fetches fresh keys from server */
export const resetApiKeyCache = (): void => { 
  cachedApiKey = null; 
  cachedGroqApiKey = null;
};

// Helper for stateless reset
export const resetChatSession = () => {
  // Stateless implementation doesn't require reset, but keeping for compatibility
};

/**
 * Text-to-speech using Gemini 2.5 Flash TTS model.
 * Explicitly exported to fix the AdminDashboard error.
 */
export async function playGeminiTTS(text: string, voiceName: string = 'Kore') {
  const apiKey = await getApiKey();
  const ai = new GoogleGenAI({ apiKey: apiKey as string });
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName as any },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
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
}

/**
 * Sends a message to Gemini using the generateContentStream API.
 */

async function executeTool(name: string, args: any): Promise<any> {
  try {
    if (name === 'end_conversation') {
      return { success: true, reason: args.reason };
    }
    
    if (name === 'calculate_shipping') {
      const { destinationZip, destinationCity, destinationState, cartItems } = args;
      
      let totalWeightKg = 0;
      let totalVolumeCbm = 0;
      if (Array.isArray(cartItems)) {
        for (const item of cartItems) {
          const { productId, quantity } = item;
          const prod = PRODUCTS.find((p: any) => p.id === String(productId));
          let unitWeight = 5.0; // default
          let unitVolume = 0.02; // default
          if (prod) {
            const cat = prod.category.toUpperCase();
            if (cat.includes("CIELO") || cat.includes("TECHO")) {
              unitWeight = 3.0;
              unitVolume = 0.015;
            } else if (cat.includes("PISO") || cat.includes("DECK")) {
              unitWeight = 12.0;
              unitVolume = 0.03;
            } else if (cat.includes("CUBIERTA") || cat.includes("ROOF")) {
              unitWeight = 25.0;
              unitVolume = 0.1;
            } else if (cat.includes("PARED") || cat.includes("PANEL")) {
              unitWeight = 8.0;
              unitVolume = 0.025;
            } else if (cat.includes("CINTA") || cat.includes("PEGANTE")) {
              unitWeight = 1.0;
              unitVolume = 0.002;
            }
          }
          totalWeightKg += unitWeight * Number(quantity);
          totalVolumeCbm += unitVolume * Number(quantity);
        }
      }
      
      const res = await fetch('/api/calculate-shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationZip,
          destinationCity,
          destinationState,
          totalWeightKg,
          totalVolumeCbm
        })
      });
      
      if (res.ok) {
        return await res.json();
      } else {
        throw new Error(`Shipping API error: ${res.statusText}`);
      }
    }
    
    if (name === 'generate_checkout_payment_link') {
      const { subtotal, shippingCost, total, customerName, customerEmail, cartItems } = args;
      const res = await fetch('/api/create-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtotal,
          shippingCost,
          total,
          customerName,
          customerEmail,
          cartItems
        })
      });
      
      if (res.ok) {
        return await res.json();
      } else {
        throw new Error(`Stripe Payment API error: ${res.statusText}`);
      }
    }
    
    return { status: "success", message: `Tool ${name} executed successfully` };
  } catch (error: any) {
    console.error(`Error executing tool ${name}:`, error);
    return { error: error.message || "Failed to execute tool" };
  }
}


export async function* sendMessageToGroq(
  message: string,
  history: any[] = [],
  instructions: string,
  _language: Language = 'es'
): AsyncGenerator<any, void, unknown> {
  const groqApiKey = await getGroqApiKey();
  if (!groqApiKey) {
    throw new Error('Groq API key is not configured');
  }

  const groqMessages = [
    { role: 'system', content: instructions },
    ...history.map(h => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.parts?.[0]?.text || ''
    }))
  ];
  
  if (message) {
    groqMessages.push({ role: 'user', content: message });
  }

  // Detect if the key is for xAI/Grok (starts with "xai-")
  const isXAI = groqApiKey.trim().startsWith('xai-');
  const endpoint = isXAI 
    ? 'https://api.x.ai/v1/chat/completions' 
    : 'https://api.groq.com/openai/v1/chat/completions';
  const model = isXAI 
    ? 'grok-latest' 
    : 'llama-3.3-70b-versatile';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: groqMessages,
      stream: true
    })
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Groq API error (${response.status}): ${errorBody || response.statusText}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder('utf-8');
  if (!reader) throw new Error('Failed to get stream reader from Groq');

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
        if (!trimmed) continue;
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;
          try {
            const json = JSON.parse(dataStr);
            const chunkText = json.choices?.[0]?.delta?.content || '';
            if (chunkText) {
              yield {
                text: chunkText,
                candidates: [{
                  content: {
                    parts: [{ text: chunkText }]
                  }
                }]
              };
            }
          } catch (e) {
            // Ignore parse errors on partial trailing lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function* sendMessageToGemini(
  message: string,
  history: any[] = [],
  emergencyMode: boolean = false,
  language: Language = 'es',
  onToolSuccess?: (toolName: string, result: any) => void,
  customGreeting?: string,
  brandId: 'unitec' | 'building' = 'unitec'
): AsyncGenerator<any, void, unknown> {
  const apiKey = await getApiKey();
  const ai = new GoogleGenAI({ apiKey: apiKey as string });
  let instructions = getSystemInstruction(language, customGreeting, brandId);
  if (emergencyMode) {
    instructions += "\n\n[SYSTEM OVERRIDE: EMERGENCY MODE ACTIVE]. Respond concisely. Prioritize safety protocols immediately.";
  }

  // --- Retry with exponential backoff (3 attempts) ---
  let responseStream;
  let lastError = null;
  for (let _attempt = 1; _attempt <= 3; _attempt++) {
    try {
      responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.0-flash',
        contents: [...history, { role: 'user', parts: [{ text: message }] }],
        config: {
          systemInstruction: instructions,
          tools: [{ functionDeclarations: TOOLS }],
        },
      });
      break; // success
    } catch (_err: any) {
      lastError = _err;
      const _isAuth = _err?.status === 401 || _err?.status === 403;
      if (_isAuth) cachedApiKey = null; // Force re-fetch on next call
      if (_err?.status === 400 || _attempt === 3) {
        break; // break loop to enter fallback
      }
      await new Promise(r => setTimeout(r, _attempt * 1200));
    }
  }

  if (!responseStream) {
    console.warn("Gemini stream failed. Attempting silent fallback to Groq Llama 3.3-70b...");
    try {
      const groqStream = sendMessageToGroq(message, history, instructions, language);
      for await (const chunk of groqStream) {
        yield chunk;
      }
      return; // Fallback succeeded, end generator
    } catch (groqErr) {
      console.error("Groq fallback also failed:", groqErr);
      throw lastError || groqErr; // throw original Gemini error if Groq also fails
    }
  }

  let toolCallPart: any = null;

  for await (const chunk of responseStream) {
    const c = chunk as GenerateContentResponse;
    if (c.usageMetadata) {
      const totalTokens = c.usageMetadata.totalTokenCount;
      trackUsage({
        totalTokens: totalTokens,
        chatTokens: totalTokens,
        apiCalls: 1
      });
    }

    const part = c.candidates?.[0]?.content?.parts?.find(p => p.functionCall);
    if (part && part.functionCall && part.functionCall.name) {
      toolCallPart = part.functionCall;
    }
    yield c;
  }

  if (toolCallPart && toolCallPart.name) {
    const toolName = toolCallPart.name;
    const toolArgs = toolCallPart.args;
    
    // Execute the tool
    const toolResult = await executeTool(toolName, toolArgs);
    
    if (onToolSuccess) {
      onToolSuccess(toolName, { ...toolArgs, ...toolResult });
    }
    
    // Build recursive history and continue the generation
    const updatedHistory = [
      ...history,
      { role: 'user' as const, parts: [{ text: message }] },
      { role: 'model' as const, parts: [{ functionCall: toolCallPart }] },
      { role: 'user' as const, parts: [{ functionResponse: { name: toolName, response: toolResult } }] }
    ];
    
    const nextStream = sendMessageToGemini("", updatedHistory, emergencyMode, language, onToolSuccess, customGreeting, brandId);
    for await (const nextChunk of nextStream) {
      yield nextChunk;
    }
  }
}

/**
 * Generates embeddings for the given text using Gemini Embedding 2.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const apiKey = await getApiKey();
    const ai = new GoogleGenAI({ apiKey: apiKey as string });
    const result = await ai.models.embedContent({
      model: 'gemini-embedding-2-preview',
      contents: [text],
    });
    
    if (result.embeddings && result.embeddings.length > 0 && result.embeddings[0].values) {
      // Track API call usage
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
    language: Language = 'es',
    voiceName: VoiceName = 'Kore',
    customGreeting?: string,
    brandId: 'unitec' | 'building' = 'unitec'
) => {
  const apiKey = await getApiKey();
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
    model: 'gemini-2.0-flash',
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

        // Immediate greeting trigger
        const greetPrompt = customGreeting 
          ? `Â¡Hola! Por favor salÃºdame inmediatamente con nuestro saludo personalizado de la empresa en espaÃ±ol: "${customGreeting}"`
          : (language === 'en' 
            ? "Hello! Please greet me now cordially, introduce yourself as the front desk coordinator of UNITEC Design." 
            : "Â¡Hola! Por favor salÃºdame con mucho entusiasmo ahora mismo en espaÃ±ol, dÃ¡ndome la bienvenida a UNITEC Design.");

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

        // Handle transcriptions
        const modelTranscript = parts?.find(p => p.text)?.text;
        // User transcript is in serverContent.userContent if enabled
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
                executeTool(fc.name, fc.args).then(toolResult => {
                  if (callbacks.onToolSuccess) {
                    callbacks.onToolSuccess(fc.name || '', { status: 'success', ...fc.args, ...toolResult });
                  }
                  sessionPromise.then(s => s.sendToolResponse({
                    functionResponses: [{
                      id: fc.id || '',
                      name: fc.name || '',
                      response: toolResult
                    }]
                  }));
                }).catch(err => {
                  console.error("Live tool execution error:", err);
                  sessionPromise.then(s => s.sendToolResponse({
                    functionResponses: [{
                      id: fc.id || '',
                      name: fc.name || '',
                      response: { error: err.message || "Failed to execute tool" }
                    }]
                  }));
                });
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

  sessionPromise.catch(e => {
    console.error('Live session promise rejected:', e);
    callbacks.onError(e);
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



// ============================================================
// AI CONVERSATION SUMMARIZATION
// Generates a structured summary + Q&A pairs for retraining
// ============================================================
export async function generateConversationSummary(
  messages: Array<{ role: string; text: string }>,
  brandId: 'unitec' | 'building' = 'unitec'
): Promise<{ summary: string; qaPairs: Array<{ question: string; answer: string; category?: string }> }> {
  try {
    const apiKey = await getApiKey();
    const ai = new GoogleGenAI({ apiKey: apiKey as string });

    const transcript = messages
      .map(m => `[${m.role === 'user' ? 'CLIENTE' : m.role === 'staff' ? 'STAFF' : 'ASISTENTE'}]: ${m.text}`)
      .join('\n');

    const brandName = brandId === 'unitec' ? 'UNITEC Design' : 'Building Innovation';

    const prompt = `Analiza esta conversaciï¿½n de atenciï¿½n al cliente de ${brandName} y devuelve un JSON con el siguiente formato exacto:
{
  "summary": "Resumen ejecutivo de la conversaciï¿½n en 2-3 oraciones. Incluye: quï¿½ querï¿½a el cliente, cï¿½mo respondiï¿½ el asistente, resultado final.",
  "qaPairs": [
    {
      "question": "Pregunta exacta o parafraseada que hizo el cliente",
      "answer": "Respuesta que dio el asistente",
      "category": "products|pricing|shipping|services|general|complaint|appointment"
    }
  ]
}

CONVERSACIï¿½N:
${transcript}

INSTRUCCIONES:
- Devuelve SOLO el JSON, sin explicaciones adicionales.
- Extrae todas las preguntas y respuestas importantes.
- Si el cliente no obtuvo respuesta satisfactoria, incluye igualmente el par con la respuesta real del asistente.
- El resumen debe ser en espaï¿½ol.
- Mï¿½ximo 10 pares de Q&A.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    });

    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    // Strip markdown code fences if present
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      summary: parsed.summary || 'Sin resumen disponible.',
      qaPairs: Array.isArray(parsed.qaPairs) ? parsed.qaPairs : [],
    };
  } catch (error) {
    console.error('Error generating conversation summary:', error);
    return { summary: 'Error al generar resumen.', qaPairs: [] };
  }
}


