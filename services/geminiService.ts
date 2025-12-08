import { GoogleGenAI, Chat, LiveServerMessage, Modality } from "@google/genai";
import { SYSTEM_INSTRUCTION, TOOLS } from "../constants";
import { createBlob, decodeAudioData, base64ToUint8Array, blobToBase64 } from "../utils/audioUtils";

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

    return { status: "success", confirmationId: "APT-" + Math.floor(Math.random() * 10000) };
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

// Helper to reset session if needed (e.g. emergency mode toggle)
export const resetChatSession = () => {
  chatSession = null;
};

export const getChatSession = (emergencyMode: boolean = false) => {
  if (!chatSession) {
    const ai = getAIClient();
    let instructions = SYSTEM_INSTRUCTION;
    
    if (emergencyMode) {
      instructions += "\n\n[SYSTEM OVERRIDE: EMERGENCY MODE ACTIVE]. Respond concisely. Prioritize safety protocols immediately.";
    }

    chatSession = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: instructions,
      },
    });
  }
  return chatSession;
};

export const sendMessageToGemini = async (message: string, emergencyMode: boolean = false) => {
  try {
    const session = getChatSession(emergencyMode);
    const response = await session.sendMessageStream({ message });
    return response;
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    throw error;
  }
};

// --- Live API (Voice) Service ---

export interface LiveSessionCallbacks {
  onOpen: () => void;
  onMessage: (text: string | null, audioBuffer: AudioBuffer | null, isInterrupted: boolean) => void;
  onAudioData: (data: Uint8Array) => void; // For visualizer
  onError: (error: Error) => void;
  onClose: () => void;
  onToolCall: (toolName: string) => void;
}

export const connectLiveSession = async (callbacks: LiveSessionCallbacks, emergencyMode: boolean = false) => {
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

  let instructions = SYSTEM_INSTRUCTION;
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
                } else if (fc.name === 'log_to_crm') {
                    result = await mockLogToCRM(fc.args);
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
            nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
            audioBuffer = await decodeAudioData(
              base64ToUint8Array(base64Audio),
              outputAudioContext,
              24000,
              1
            );
            
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            // Connect to analyser, which is already connected to destination
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
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
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
    }
  };
};