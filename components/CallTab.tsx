import React, { useState, useEffect, useRef } from 'react';
import { Mic, Phone, AlertCircle, CalendarCheck, Database, Loader2, CheckCircle2, Download, Activity, Globe } from 'lucide-react';
import { connectLiveSession, sendMessageToGemini } from '../services/geminiService';
import { playDeepgramTTS } from '../services/deepgramService';
import AudioVisualizer from './AudioVisualizer';
import { Language, VoiceName, VoiceProvider } from '../types';
import { UI_TRANSLATIONS } from '../constants';

interface CallTabProps {
  emergencyMode?: boolean;
  language: Language;
  voiceName: VoiceName;
  voiceProvider: VoiceProvider;
  deepgramKey?: string;
}

const CallTab: React.FC<CallTabProps> = ({ emergencyMode, language, voiceName, voiceProvider, deepgramKey }) => {
  const t = UI_TRANSLATIONS[language];
  
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error' | 'listening' | 'processing' | 'speaking'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [audioData, setAudioData] = useState<Uint8Array>(new Uint8Array(64));
  const [activeTool, setActiveTool] = useState<string | null>(null);
  
  const [showBookingConfirmation, setShowBookingConfirmation] = useState(false);
  const [confirmedDate, setConfirmedDate] = useState<string | null>(null);
  
  const [lastRecordingUrl, setLastRecordingUrl] = useState<string | null>(null);

  // Gemini Live Session Ref
  const sessionControllerRef = useRef<{ disconnect: () => Promise<void>; getAudioBlob: () => Blob } | null>(null);

  // Deepgram / Web Speech Refs
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isHybridActive = useRef(false);

  useEffect(() => {
    return () => {
      stopAll();
    };
  }, []);

  const stopAll = async () => {
    // Stop Gemini Live
    if (sessionControllerRef.current) {
      await sessionControllerRef.current.disconnect();
      sessionControllerRef.current = null;
    }
    // Stop Web Speech
    if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
    }
    // Stop Deepgram Audio
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
    }
    isHybridActive.current = false;
  };

  useEffect(() => {
    if (showBookingConfirmation) {
        const timer = setTimeout(() => setShowBookingConfirmation(false), 5000);
        return () => clearTimeout(timer);
    }
  }, [showBookingConfirmation]);

  useEffect(() => {
    if (activeTool) {
      const timer = setTimeout(() => setActiveTool(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [activeTool]);

  const mapErrorToUserMessage = (error: Error): string => {
    const msg = error.message;
    if (language === 'en') {
        if (msg.includes("API_KEY_MISSING")) return "Configuration Error: API Key missing.";
        if (msg.includes("MIC_PERMISSION_DENIED")) return "Microphone access denied.";
        if (msg.includes("MIC_NOT_FOUND")) return "No microphone detected.";
        if (msg.includes("CONNECTION_ERROR")) return "Network connection interrupted.";
        return "An unexpected error occurred.";
    } else {
        if (msg.includes("API_KEY_MISSING")) return "Error de Configuración: Falta API Key.";
        if (msg.includes("MIC_PERMISSION_DENIED")) return "Acceso al micrófono denegado.";
        if (msg.includes("MIC_NOT_FOUND")) return "Micrófono no encontrado.";
        if (msg.includes("CONNECTION_ERROR")) return "Conexión interrumpida.";
        return "Ocurrió un error inesperado.";
    }
  };

  // --- Hybrid Mode Logic (Deepgram) ---
  const startHybridConversation = () => {
    if (!('webkitSpeechRecognition' in window)) {
        setErrorMessage(language === 'en' ? "Browser not supported for Hybrid Mode." : "Navegador no compatible.");
        setStatus('error');
        return;
    }
    
    if (!deepgramKey) {
        setErrorMessage(language === 'en' ? "Deepgram API Key Missing" : "Falta la API Key de Deepgram");
        setStatus('error');
        return;
    }

    isHybridActive.current = true;
    setStatus('listening');

    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language === 'en' ? 'en-US' : 'es-ES';

    recognition.onstart = () => {
        setStatus('listening');
    };

    recognition.onresult = async (event: any) => {
        const text = event.results[0][0].transcript;
        console.log("User said:", text);
        setStatus('processing');
        
        try {
            // 1. Get Text response from Gemini
            const responseGenerator = sendMessageToGemini(
                text, 
                emergencyMode, 
                language,
                (toolName, result) => {
                     setActiveTool(toolName);
                     if (toolName === 'book_appointment') {
                        setConfirmedDate(result.date || null);
                        setShowBookingConfirmation(true);
                     }
                }
            );

            let fullText = "";
            for await (const chunk of responseGenerator) {
                if (chunk.text) fullText += chunk.text;
            }

            // 2. Send Text to Deepgram TTS
            if (isHybridActive.current) {
                setStatus('speaking');
                const audio = await playDeepgramTTS(
                    fullText, 
                    deepgramKey, 
                    voiceName,
                    () => setStatus('speaking'),
                    () => {
                        if (isHybridActive.current) {
                            try {
                                recognition.start(); // Loop back to listening
                            } catch (e) { /* ignore already started */ }
                        }
                    }
                );
                audioRef.current = audio || null;
            }

        } catch (e) {
            console.error(e);
            setStatus('error');
        }
    };

    recognition.onerror = (event: any) => {
        console.error("Speech Recognition Error", event.error);
        if (event.error === 'no-speech') {
             // Just restart if silent
             if (isHybridActive.current && status !== 'speaking') {
                 try { recognition.start(); } catch (e) {}
             }
        }
    };
    
    recognition.onend = () => {
        if (isHybridActive.current && status !== 'processing' && status !== 'speaking') {
             try { recognition.start(); } catch (e) {}
        }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // --- Main Handlers ---

  const handleStartCall = async () => {
    setErrorMessage('');
    
    // Cleanup previous
    if (lastRecordingUrl) {
        URL.revokeObjectURL(lastRecordingUrl);
        setLastRecordingUrl(null);
    }

    if (voiceProvider === 'deepgram') {
        startHybridConversation();
    } else {
        // Native Gemini Live Mode
        setStatus('connecting');
        try {
            const session = await connectLiveSession({
                onOpen: () => setStatus('connected'),
                onMessage: () => {},
                onAudioData: (data) => setAudioData(data),
                onToolCall: (name) => setActiveTool(name),
                onToolSuccess: (name, res) => {
                     if (name === 'book_appointment') {
                        setConfirmedDate(res.date || null);
                        setShowBookingConfirmation(true);
                     }
                },
                onError: (err) => {
                    setErrorMessage(mapErrorToUserMessage(err));
                    setStatus('error');
                },
                onClose: () => setStatus('idle')
            }, emergencyMode, language, voiceName);
            
            if (session) sessionControllerRef.current = session;

        } catch (e: any) {
            setErrorMessage(mapErrorToUserMessage(e));
            setStatus('error');
        }
    }
  };

  const handleEndCall = async () => {
    isHybridActive.current = false;
    
    // Save recording if available (Gemini Mode only)
    if (sessionControllerRef.current) {
      const blob = sessionControllerRef.current.getAudioBlob();
      if (blob.size > 100) {
          const url = URL.createObjectURL(blob);
          setLastRecordingUrl(url);
      }
    }

    await stopAll();
    setStatus('idle');
  };

  const isActive = status === 'connected' || status === 'listening' || status === 'speaking' || status === 'processing';

  return (
    <div className="h-full flex flex-col bg-slate-50 relative overflow-hidden font-sans">
      
      {/* Top Status Area */}
      <div className="pt-10 pb-4 text-center z-10 px-6 transition-opacity duration-300">
        <div className="flex justify-center items-center gap-2 mb-1">
             <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">{t.voiceTitle}</h2>
             <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                 voiceProvider === 'deepgram' 
                 ? 'bg-purple-50 text-purple-600 border-purple-200' 
                 : 'bg-blue-50 text-blue-600 border-blue-200'
             }`}>
                 {voiceProvider === 'deepgram' ? 'Deepgram' : 'Gemini'}
             </span>
        </div>
        <div className={`text-xl font-light tracking-tight transition-colors duration-300 ${
            status === 'error' ? 'text-red-600' : 
            isActive ? 'text-slate-800' : 'text-slate-500'
        }`}>
          {status === 'idle' && t.tapToStart}
          {status === 'connecting' && <span className="animate-pulse">{t.connecting}</span>}
          {status === 'connected' && t.connected}
          {status === 'listening' && "Listening..."}
          {status === 'processing' && "Thinking..."}
          {status === 'speaking' && "Speaking..."}
          {status === 'error' && t.connectionFailed}
        </div>
      </div>

      {/* Visualizer / Centerpiece */}
      <div className="flex-1 relative flex flex-col items-center justify-center min-h-[300px]">
        
        {/* Success Banner */}
        <div className={`absolute top-0 z-40 transition-all duration-500 transform w-full px-6 flex justify-center ${
            showBookingConfirmation ? 'translate-y-12 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
        }`}>
            <div className="bg-emerald-500/90 backdrop-blur text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
                <div className="bg-white/20 p-1 rounded-full">
                    <CheckCircle2 size={18} className="text-white" />
                </div>
                <div>
                   <p className="text-xs font-bold tracking-wide">{t.bookingConfirmed}</p>
                   {confirmedDate && <p className="text-[10px] font-medium opacity-90">{confirmedDate}</p>}
                </div>
            </div>
        </div>

        {/* Pro Tool Status */}
        <div className={`absolute top-0 z-30 transition-all duration-500 ease-out transform ${
            activeTool && !showBookingConfirmation ? 'translate-y-2 opacity-100' : '-translate-y-4 opacity-0'
        }`}>
            <div className="bg-slate-900/95 backdrop-blur-sm text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700/50">
                {activeTool === 'book_appointment' ? <CalendarCheck size={14} className="text-emerald-400" /> : 
                 activeTool === 'log_to_crm' ? <Database size={14} className="text-sky-400" /> : 
                 <Loader2 size={14} className="text-slate-400 animate-spin" />}
                
                <div className="flex flex-col leading-none">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">System Action</span>
                    <span className="text-xs font-semibold tracking-wide">
                        {activeTool === 'book_appointment' ? 'Syncing Calendar' : 
                         activeTool === 'log_to_crm' ? 'Updating CRM' : 'Processing...'}
                    </span>
                </div>
            </div>
        </div>

        <div className="relative z-10 w-full flex flex-col items-center justify-center space-y-12">
            {/* Visualizer (Only active in Gemini mode for now, simpler placeholder for Deepgram) */}
            <div className={`h-[100px] w-full flex items-center justify-center px-8 transition-opacity duration-500 ${activeTool ? 'opacity-30' : 'opacity-100'}`}>
                {voiceProvider === 'gemini' ? (
                    <AudioVisualizer audioData={audioData} isActive={status === 'connected'} />
                ) : (
                    <div className="h-[100px] w-full flex items-center justify-center">
                        {status === 'speaking' && <Activity className="text-purple-500 animate-bounce" size={48} />}
                        {status === 'listening' && <Mic className="text-slate-300 animate-pulse" size={32} />}
                        {status === 'processing' && <Loader2 className="text-slate-400 animate-spin" size={32} />}
                    </div>
                )}
            </div>

            {/* Main Button */}
            <div className="relative group">
                {activeTool && <div className="absolute inset-0 rounded-full border border-sky-400/30 animate-ping" />}
                
                <div 
                    onClick={status === 'idle' ? handleStartCall : undefined}
                    className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 shadow-xl ${
                    isActive
                        ? activeTool 
                            ? 'bg-slate-900 scale-100 ring-2 ring-sky-500/50' 
                            : voiceProvider === 'deepgram' 
                                ? 'bg-white scale-110 ring-1 ring-purple-200' 
                                : 'bg-white scale-110 ring-1 ring-slate-200'
                        : status === 'error' 
                        ? 'bg-red-50 border-2 border-red-200'
                        : 'bg-slate-900 cursor-pointer hover:scale-105 hover:shadow-2xl'
                    }`}
                >
                    {isActive ? (
                        activeTool ? <Loader2 size={24} className="text-sky-400 animate-spin" /> : 
                        <div className="relative">
                             <div className={`absolute inset-0 blur-lg opacity-20 animate-pulse ${voiceProvider === 'deepgram' ? 'bg-purple-500' : 'bg-brand-500'}`}></div>
                             {voiceProvider === 'deepgram' ? <Activity size={24} className="text-purple-600 relative z-10" /> : <Mic size={24} className="text-brand-600 relative z-10" />}
                        </div>
                    ) : status === 'error' ? (
                        <AlertCircle size={24} className="text-red-500" />
                    ) : status === 'connecting' ? (
                         <Loader2 size={24} className="text-white animate-spin" />
                    ) : (
                        <Mic size={24} className="text-white" />
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* Controls Area */}
      <div className="w-full p-8 pt-0 space-y-6 shrink-0 z-10">
        
        {/* Download Button (Only in Gemini Mode for now) */}
        {status === 'idle' && lastRecordingUrl && (
            <div className="flex justify-center mb-2 animate-in fade-in slide-in-from-bottom-4">
                <a
                    href={lastRecordingUrl}
                    download={`recording-${new Date().toISOString()}.wav`}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-emerald-100 transition-colors border border-emerald-100"
                >
                    <Download size={16} />
                    Download Recording
                </a>
            </div>
        )}

        {status === 'error' && (
          <div className="bg-red-50/50 backdrop-blur border border-red-100 text-red-700 text-sm p-4 rounded-xl text-center">
            <p className="font-medium mb-2">{errorMessage}</p>
            <button 
                onClick={() => setStatus('idle')}
                className="text-xs font-bold uppercase tracking-wide text-red-800 hover:text-red-950 border-b border-red-300 pb-0.5"
            >
                Reset Connection
            </button>
          </div>
        )}

        {status === 'idle' && (
          <button 
            onClick={handleStartCall}
            className={`w-full text-white font-medium text-sm tracking-wide uppercase py-4 rounded-xl shadow-lg transition-transform active:scale-[0.98] ${
                voiceProvider === 'deepgram' 
                ? 'bg-purple-700 hover:bg-purple-800' 
                : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {t.startConversation}
          </button>
        )}
        
        {isActive && (
          <div className="flex justify-center pt-4">
            <button 
              onClick={handleEndCall}
              className="group flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors"
            >
              <Phone size={18} className="rotate-[135deg]" />
              <span className="text-xs font-bold uppercase tracking-widest">{t.endCall}</span>
            </button>
          </div>
        )}
        
        {!status.includes('idle') && !status.includes('error') && (
          <p className="text-[10px] text-center text-slate-300 font-medium tracking-widest uppercase mt-4">
            {voiceProvider === 'deepgram' ? 'Hybrid Mode: WebSpeech + Deepgram' : t.secureConnection}
          </p>
        )}
      </div>
    </div>
  );
};

export default CallTab;