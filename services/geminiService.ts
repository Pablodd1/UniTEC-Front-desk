import { GoogleGenAI, Chat, LiveServerMessage, Modality, FunctionCall } from "@google/genai";
import { getSystemInstruction, TOOLS } from "../constants";
import { createBlob, decodeAudioData, base64ToUint8Array, blobToBase64, pcmToWavBlob } from "../utils/audioUtils";
import { Language, VoiceName } from "../types";

const API_KEY = process.env.API_KEY || ''; 

// Validate API Key immediately
const getAIClient = () => {
  if (!API_KEY) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey: API_KEY });
};

// --- Mock CRM / Backend Actions ---
export const mockBookAppointment = async (data: any) => {
  console.log("Backend: Booking appointment...", data);
  try {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate basic validation
    if (!data.date || !data.customerName) {
      throw new Error("Missing required booking fields");
    }

    return { 
        status: "success", 
        confirmationId: "APT-" + Math.floor(Math.random() * 10000),
        date: data.date 
    };
  } catch (error) {
    console.error("Booking failed:", error);
    return { status: "error", message: "Failed to book appointment" };
  }
};

export const mockLogToCRM = async (data: any) => {
  console.log("Backend: Logging to CRM...", data);
  try {
    const logsString = localStorage.getItem('unitec_crm_logs') || '[]';
    let logs = [];
    try {
      logs = JSON.parse(logsString);
      if (!Array.isArray(logs)) logs = [];
    } catch (e) {
      console.warn("Corrupt CRM logs found, resetting.", e);
      logs = [];
    }

    logs.unshift({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      customerName: "Walk-in / Voice User",
      summary: data.summary || "No summary provided",
      actionTaken: data.actionTaken || "General Inquiry",
      sentiment: data.sentiment || "Neutral"
    });
    localStorage.setItem('unitec_crm_logs', JSON.stringify(logs));
    return { status: "logged" };
  } catch (error) {
    console.error("CRM Log failed:", error);
    return { status: "error", message: "Failed to log interaction" };
  }
};

// --- Chat Service ---

let chatSession: Chat | null = null;
let currentLanguage: Language = 'en';

// Helper to reset session if needed (e.g. emergency mode toggle or language change)
export const resetChatSession = () => {
  chatSession = null;
};

export const getChatSession = (emergencyMode: boolean = false, language: Language = 'en') => {
  if (!chatSession || currentLanguage !== language) {
    const ai = getAIClient();
    let instructions = getSystemInstruction(language);
    currentLanguage = language;
    
    if (emergencyMode) {
      instructions += "\n\n[SYSTEM OVERRIDE: EMERGENCY MODE ACTIVE]. Respond concisely. Prioritize safety protocols immediately.";
    }

    chatSession = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: instructions,
        tools: [{ functionDeclarations: TOOLS }],
      },
    });
  }
  return chatSession;
};

export async function* sendMessageToGemini(
  message: string, 
  emergencyMode: boolean = false, 
  language: Language = 'en',
  onToolSuccess?: (toolName: string, result: any) => void
) {
  try {
    const session = getChatSession(emergencyMode, language);
    let responseStream = await session.sendMessageStream({ message });
    
    while (true) {
        let toolCalls: FunctionCall[] = [];
        
        for await (const chunk of responseStream) {
            // Check for tool calls
            const fc = chunk.functionCalls;
            if (fc && fc.length > 0) {
                toolCalls.push(...fc);
            }
            
            // Yield text content if present
            if (chunk.text) {
                yield chunk;
            }
        }

        if (toolCalls.length > 0) {
            const functionResponses = [];
            for (const call of toolCalls) {
                let result = {};
                if (call.name === 'book_appointment') {
                    result = await mockBookAppointment(call.args);
                    if ((result as any).status === 'success') {
                        onToolSuccess?.(call.name, result);
                    }
                } else if (call.name === 'log_to_crm') {
                    result = await mockLogToCRM(call.args);
                    if ((result as any).status === 'logged') {
                        onToolSuccess?.(call.name, result);
                    }
                }
                
                functionResponses.push({
                    name: call.name,
                    response: { result },
                    id: call.id
                });
            }

            // Send tool responses back to model
            responseStream = await session.sendMessageStream({
                parts: [{ functionResponse: { functionResponses: functionResponses } }]
            } as any);
        } else {
            // No more tool calls, we are done
            break;
        }
    }

  } catch (error) {
    console.error("Gemini Chat Error:", error);
    throw error;
  }
}

// --- Live API (Voice) Service ---

export interface LiveSessionCallbacks {
  onOpen: () => void;
  onMessage: (text: string | null, audioBuffer: AudioBuffer | null, isInterrupted: boolean) => void;
  onAudioData: (data: Uint8Array) => void; // For visualizer
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
  let ai;
  try {
    ai = getAIClient();
  } catch (error) {
    callbacks.onError(new Error("API_KEY_MISSING"));
    return null;
  }

  const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
  const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  
  // Audio Analysis for Visualizer
  const analyser = outputAudioContext.createAnalyser();
  analyser.fftSize = 64; 
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  // Connect analyser only once to the destination to avoid graph topology errors
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
    console.error("Microphone access denied:", err);
    clearInterval(visualizerInterval);
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      callbacks.onError(new Error("MIC_PERMISSION_DENIED"));
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      callbacks.onError(new Error("MIC_NOT_FOUND"));
    } else {
      callbacks.onError(new Error("MIC_UNKNOWN_ERROR"));
    }
    return null;
  }

  // Ensure AudioContexts are running (fixes Autoplay policy issues)
  await inputAudioContext.resume();
  await outputAudioContext.resume();

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
        
        scriptProcessor.onaudioprocess = async (audioProcessingEvent) => {
          const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
          const pcmBlob = createBlob(inputData);
          const base64Data = await blobToBase64(pcmBlob);
          
          sessionPromise.then((session) => {
            session.sendRealtimeInput({
               media: {
                 mimeType: 'audio/pcm;rate=16000',
                 data: base64Data
               }
            });
          });
        };

        source.connect(scriptProcessor);
        scriptProcessor.connect(inputAudioContext.destination);
      },
      onmessage: async (message: LiveServerMessage) => {
        // Tool Handling
        if (message.toolCall) {
            console.log("Tool Call received:", message.toolCall);
            for (const fc of message.toolCall.functionCalls) {
                callbacks.onToolCall(fc.name);
                
                let result = {};
                if (fc.name === 'book_appointment') {
                    result = await mockBookAppointment(fc.args);
                    if ((result as any).status === 'success') {
                        callbacks.onToolSuccess?.(fc.name, result);
                    }
                } else if (fc.name === 'log_to_crm') {
                    result = await mockLogToCRM(fc.args);
                    if ((result as any).status === 'logged') {
                        callbacks.onToolSuccess?.(fc.name, result);
                    }
                }

                sessionPromise.then(session => {
                    session.sendToolResponse({
                        functionResponses: {
                            id: fc.id,
                            name: fc.name,
                            response: { result }
                        }
                    });
                });
            }
        }

        // Audio Handling
        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        let audioBuffer: AudioBuffer | null = null;

        if (base64Audio) {
          try {
            // 1. Convert to Uint8Array
            const audioData = base64ToUint8Array(base64Audio);
            // 2. Store for download
            audioChunks.push(audioData);

            // 3. Playback logic
            nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
            audioBuffer = await decodeAudioData(
              audioData,
              outputAudioContext,
              24000,
              1
            );
            
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(analyser); 
            
            source.addEventListener('ended', () => {
              sources.delete(source);
            });
            
            source.start(nextStartTime);
            nextStartTime += audioBuffer.duration;
            sources.add(source);
          } catch (e) {
            console.error("Error decoding audio", e);
          }
        }

        const interrupted = message.serverContent?.interrupted;
        if (interrupted) {
          for (const src of sources.values()) {
            src.stop();
            sources.delete(src);
          }
          nextStartTime = 0;
        }

        callbacks.onMessage(null, audioBuffer, !!interrupted);
      },
      onerror: (e) => {
        console.error("Gemini Live API Error:", e);
        callbacks.onError(new Error("CONNECTION_ERROR"));
      },
      onclose: () => {
        callbacks.onClose();
        clearInterval(visualizerInterval);
      }
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } }
      },
      systemInstruction: instructions,
      tools: [{ functionDeclarations: TOOLS }]
    }
  });

  return {
    disconnect: async () => {
      clearInterval(visualizerInterval);
      try {
        const session = await sessionPromise;
        session.close();
      } catch (e) {
        console.warn("Session close error", e);
      }
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      if (inputAudioContext.state !== 'closed') inputAudioContext.close();
      if (outputAudioContext.state !== 'closed') outputAudioContext.close();
    },
    getAudioBlob: () => {
      return pcmToWavBlob(audioChunks, 24000);
    }
  };
};