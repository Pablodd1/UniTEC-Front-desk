
// geminiService.ts handles interactions with the Google GenAI SDK
import { GoogleGenAI, LiveServerMessage, Modality, GenerateContentResponse } from "@google/genai";
import { getSystemInstruction, TOOLS } from "../constants";
import { createBlob, decodeAudioData, base64ToUint8Array, blobToBase64, pcmToWavBlob } from "../utils/audioUtils";
import { Language, VoiceName } from "../types";

// Helper for stateless reset
export const resetChatSession = () => {
  // Stateless implementation doesn't require reset, but keeping for compatibility
};

/**
 * Sends a message to Gemini using the generateContentStream API.
 * Handles function calls by notifying the UI through onToolSuccess.
 */
export async function* sendMessageToGemini(
  message: string,
  emergencyMode: boolean = false,
  language: Language = 'en',
  onToolSuccess?: (toolName: string, result: any) => void
) {
  // Create a new instance right before use to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  let instructions = getSystemInstruction(language);
  if (emergencyMode) {
    instructions += "\n\n[SYSTEM OVERRIDE: EMERGENCY MODE ACTIVE]. Respond concisely. Prioritize safety protocols immediately.";
  }

  const responseStream = await ai.models.generateContentStream({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: message }] }],
    config: {
      systemInstruction: instructions,
      tools: [{ functionDeclarations: TOOLS }],
    },
  });

  for await (const chunk of responseStream) {
    // Check for function calls in the stream candidates
    const part = chunk.candidates?.[0]?.content?.parts?.find(p => p.functionCall);
    if (part && part.functionCall) {
      if (onToolSuccess) {
        onToolSuccess(part.functionCall.name, part.functionCall.args);
      }
    }
    yield chunk;
  }
}

/**
 * Text-to-speech using Gemini 2.5 Flash TTS model.
 */
export const playGeminiTTS = async (text: string, voiceName: VoiceName) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  const base64Audio = audioPart?.inlineData?.data;
  if (base64Audio) {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const audioBuffer = await decodeAudioData(
      base64ToUint8Array(base64Audio),
      audioContext,
      24000,
      1,
    );
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();
  }
};

// --- Live API (Voice) Service ---

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
    voiceName: VoiceName = 'Kore'
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
  const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  
  const analyser = outputAudioContext.createAnalyser();
  analyser.fftSize = 64; 
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  analyser.connect(outputAudioContext.destination);

  const visualizerInterval = setInterval(() => {
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
    if (sum > 0) {
      callbacks.onAudioData(new Uint8Array(dataArray));
    } else {
        callbacks.onAudioData(new Uint8Array(dataArray.fill(0)));
    }
  }, 50);

  let nextStartTime = 0;
  const sources = new Set<AudioBufferSourceNode>();
  const audioChunks: Uint8Array[] = [];
  
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err: any) {
    callbacks.onError(new Error("MIC_NOT_FOUND"));
    return null;
  }

  await inputAudioContext.resume();
  await outputAudioContext.resume();

  const effectiveVoice = voiceName === 'Clone-1' ? 'Zephyr' : voiceName;

  let instructions = getSystemInstruction(language);
  if (emergencyMode) {
    instructions += "\n\n[SYSTEM OVERRIDE: EMERGENCY MODE ACTIVE]. Respond concisely. Prioritize safety protocols immediately.";
  }

  const sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks: {
      onopen: () => {
        callbacks.onOpen();
        const source = inputAudioContext.createMediaStreamSource(stream);
        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
        scriptProcessor.onaudioprocess = async (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          const pcmBlob = createBlob(inputData);
          const base64Data = await blobToBase64(pcmBlob);
          // Only send data after session is resolved to avoid race conditions
          sessionPromise.then(s => s.sendRealtimeInput({ media: { mimeType: 'audio/pcm;rate=16000', data: base64Data } }));
        };
        source.connect(scriptProcessor);
        scriptProcessor.connect(inputAudioContext.destination);
      },
      onmessage: async (message: LiveServerMessage) => {
        // Handle modelTurn audio output
        const audioPart = message.serverContent?.modelTurn?.parts?.find(p => p.inlineData);
        const base64Audio = audioPart?.inlineData?.data;
        if (base64Audio) {
            const audioData = base64ToUint8Array(base64Audio);
            audioChunks.push(audioData);
            nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
            const audioBuffer = await decodeAudioData(audioData, outputAudioContext, 24000, 1);
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(analyser); 
            source.start(nextStartTime);
            nextStartTime += audioBuffer.duration;
            sources.add(source);
        }

        // Handle tool calls in Live session
        if (message.toolCall) {
          for (const fc of message.toolCall.functionCalls) {
            callbacks.onToolCall(fc.name);
            const result = "ok"; // Standard confirmation for mock
            if (callbacks.onToolSuccess) {
              callbacks.onToolSuccess(fc.name, { status: 'success', ...fc.args });
            }
            // Inform the model that the function was executed
            sessionPromise.then(s => s.sendToolResponse({
              functionResponses: {
                id: fc.id,
                name: fc.name,
                response: { result: result }
              }
            }));
          }
        }

        callbacks.onMessage(null, null, !!message.serverContent?.interrupted);
      },
      onerror: (e) => callbacks.onError(new Error("CONNECTION_ERROR")),
      onclose: () => {
        callbacks.onClose();
        clearInterval(visualizerInterval);
      }
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: (effectiveVoice as any) } }
      },
      systemInstruction: instructions,
      tools: [{ functionDeclarations: TOOLS }]
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
    getAudioBlob: () => pcmToWavBlob(audioChunks, 24000)
  };
};
