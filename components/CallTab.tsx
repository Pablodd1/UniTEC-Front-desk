
import React, { useState, useEffect, useRef } from 'react';
import { Mic, Phone, AlertCircle, CalendarCheck, Database, Loader2, CheckCircle2, Download, Activity, Save, Headphones } from 'lucide-react';
import { connectLiveSession, sendMessageToGemini } from '../services/geminiService';
import { playDeepgramTTS } from '../services/deepgramService';
import AudioVisualizer from './AudioVisualizer';
import { Language, VoiceName, VoiceProvider, CallRecording } from '../types';
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
  const [isSaving, setIsSaving] = useState(false);

  // Gemini Live Session Ref
  const sessionControllerRef = useRef<{ disconnect: () => Promise<void>; getAudioBlob: () => Blob } | null>(null);

  // Hybrid Mode Refs
  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopAll();
    };
  }, []);

  const stopAll = async () => {
    if (sessionControllerRef.current) {
      await sessionControllerRef.current.disconnect();
      sessionControllerRef.current = null;
    }
    if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
    }
    if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const startVisualizer = (stream: MediaStream | HTMLMediaElement) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    if (analyserRef.current) analyserRef.current.disconnect();
    
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyserRef.current = analyser;

    let source;
    if (stream instanceof MediaStream) {
      source = ctx.createMediaStreamSource(stream);
    } else {
      source = ctx.createMediaElementSource(stream);
      source.connect(ctx.destination);
    }
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const update = () => {
      analyser.getByteFrequencyData(dataArray);
      setAudioData(new Uint8Array(dataArray));
      animationFrameRef.current = requestAnimationFrame(update);
    };
    update();
  };

  const initSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      throw new Error("SPEECH_NOT_SUPPORTED");
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === 'en' ? 'en-US' : 'es-ES';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => setStatus('listening');
    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        handleHybridProcess(transcript);
      }
    };
    recognition.onerror = () => {
      if (status !== 'idle') recognition.start();
    };
    recognition.onend = () => {
      if (status === 'listening') recognition.start();
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleHybridProcess = async (text: string) => {
    setStatus('processing');
    if (recognitionRef.current) recognitionRef.current.stop();

    try {
      let fullResponse = "";
      const responseGenerator = sendMessageToGemini(
        text, 
        emergencyMode, 
        language,
        (toolName, result) => {
          if (toolName === 'book_appointment') {
            setConfirmedDate(result.date || null);
            setShowBookingConfirmation(true);
          }
          setActiveTool(toolName);
        }
      );

      for await (const chunk of responseGenerator) {
        fullResponse += chunk.text || "";
      }

      if (fullResponse) {
        if (!deepgramKey) throw new Error("API_KEY_MISSING");
        
        setStatus('speaking');
        const audio = await playDeepgramTTS(
          fullResponse, 
          deepgramKey, 
          voiceName,
          () => {}, // onStart
          () => { // onEnd
            setStatus('listening');
            if (recognitionRef.current) recognitionRef.current.start();
          }
        );

        if (audio) {
          currentAudioRef.current = audio;
          startVisualizer(audio);
        }
      } else {
        setStatus('listening');
        if (recognitionRef.current) recognitionRef.current.start();
      }
    } catch (err: any) {
      setErrorMessage(mapErrorToUserMessage(err));
      setStatus('error');
    }
  };

  const handleStartCall = async () => {
    setErrorMessage('');
    if (lastRecordingUrl) {
        URL.revokeObjectURL(lastRecordingUrl);
        setLastRecordingUrl(null);
    }

    if (voiceProvider === 'deepgram') {
        if (!deepgramKey) {
          setErrorMessage(language === 'en' ? "Deepgram API Key is required." : "Se requiere la API Key de Deepgram.");
          setStatus('error');
          return;
        }
        setStatus('connecting');
        try {
          // Request mic permission for visualizer
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          startVisualizer(stream);
          initSpeechRecognition();
          setStatus('connected');
          setStatus('listening');
        } catch (e: any) {
          setErrorMessage(mapErrorToUserMessage(e));
          setStatus('error');
        }
    } else {
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
    if (sessionControllerRef.current) {
      const blob = sessionControllerRef.current.getAudioBlob();
      if (blob.size > 100) {
          const url = URL.createObjectURL(blob);
          setLastRecordingUrl(url);
          saveToLibrary(blob);
      }
    }
    await stopAll();
    setStatus('idle');
  };

  const mapErrorToUserMessage = (error: any): string => {
    const msg = error.message || String(error);
    if (language === 'en') {
        if (msg.includes("API_KEY_MISSING")) return "Configuration Error: API Key missing.";
        if (msg.includes("MIC_PERMISSION_DENIED")) return "Microphone access denied.";
        if (msg.includes("MIC_NOT_FOUND")) return "No microphone detected.";
        if (msg.includes("SPEECH_NOT_SUPPORTED")) return "Speech recognition not supported in this browser.";
        return "An unexpected error occurred.";
    } else {
        if (msg.includes("API_KEY_MISSING")) return "Error de Configuración: Falta API Key.";
        if (msg.includes("MIC_PERMISSION_DENIED")) return "Acceso al micrófono denegado.";
        if (msg.includes("MIC_NOT_FOUND")) return "Micrófono no encontrado.";
        if (msg.includes("SPEECH_NOT_SUPPORTED")) return "Reconocimiento de voz no soportado.";
        return "Ocurrió un error inesperado.";
    }
  };

  const saveToLibrary = (blob: Blob) => {
    setIsSaving(true);
    const id = Date.now().toString();
    const newRecording: CallRecording = {
        id,
        name: `Call_${id.slice(-4)}.wav`,
        timestamp: new Date().toISOString(),
        duration: "0:30"
    };

    const stored = localStorage.getItem('unitec_call_library') || '[]';
    const library = JSON.parse(stored);
    library.unshift(newRecording);
    localStorage.setItem('unitec_call_library', JSON.stringify(library));
    setTimeout(() => setIsSaving(false), 800);
  };

  const isActive = status === 'connected' || status === 'listening' || status === 'speaking' || status === 'processing';

  return (
    <div className="h-full flex flex-col bg-slate-50 relative overflow-hidden font-sans">
      
      {/* Top Status Area */}
      <div className="pt-10 pb-4 text-center z-10 px-6 transition-opacity duration-300">
        <div className="flex justify-center items-center gap-2 mb-1">
             <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">{t.voiceTitle}</h2>
             <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${
                 voiceProvider === 'deepgram' 
                 ? 'bg-purple-50 text-purple-600 border-purple-200' 
                 : 'bg-blue-50 text-blue-600 border-blue-200'
             }`}>
                 {voiceProvider === 'deepgram' ? 'Hybrid Deepgram' : 'Native Gemini'}
             </span>
        </div>
        <div className={`text-xl font-light tracking-tight transition-colors duration-300 ${
            status === 'error' ? 'text-red-600' : 
            isActive ? 'text-slate-800' : 'text-slate-500'
        }`}>
          {status === 'idle' && t.tapToStart}
          {status === 'connecting' && <span className="animate-pulse">{t.connecting}</span>}
          {status === 'connected' && t.connected}
          {status === 'listening' && (language === 'en' ? "I'm listening..." : "Escuchando...")}
          {status === 'processing' && (language === 'en' ? "Thinking..." : "Pensando...")}
          {status === 'speaking' && (language === 'en' ? "Speaking..." : "Hablando...")}
          {status === 'error' && (errorMessage || t.connectionFailed)}
        </div>
      </div>

      {/* Visualizer / Centerpiece */}
      <div className="flex-1 relative flex flex-col items-center justify-center min-h-[300px]">
        {/* Success Banner */}
        <div className={`absolute top-0 z-40 transition-all duration-500 transform w-full px-6 flex justify-center ${
            showBookingConfirmation ? 'translate-y-12 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
        }`}>
            <div className="bg-emerald-500/90 backdrop-blur text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
                <div className="bg-white/20 p-1 rounded-full"><CheckCircle2 size={18} className="text-white" /></div>
                <div>
                   <p className="text-xs font-bold tracking-wide">{t.bookingConfirmed}</p>
                   {confirmedDate && <p className="text-[10px] font-medium opacity-90">{confirmedDate}</p>}
                </div>
            </div>
        </div>

        <div className="relative z-10 w-full flex flex-col items-center justify-center space-y-12">
            <div className={`h-[100px] w-full flex items-center justify-center px-8 transition-opacity duration-500 ${activeTool ? 'opacity-30' : 'opacity-100'}`}>
                <AudioVisualizer audioData={audioData} isActive={status === 'connected' || status === 'speaking' || status === 'listening'} />
            </div>

            {/* Main Button */}
            <div className="relative group">
                <div 
                    onClick={status === 'idle' ? handleStartCall : undefined}
                    className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-700 shadow-2xl overflow-hidden ${
                    isActive
                        ? status === 'processing' || activeTool
                            ? 'bg-grass-900 animate-soft-spin ring-4 ring-emerald-500/20' 
                            : status === 'listening'
                                ? 'bg-white animate-grass-glow ring-8 ring-emerald-100 shadow-inner'
                                : 'bg-white ring-2 ring-slate-100 shadow-inner'
                        : status === 'error' 
                        ? 'bg-red-50 border-2 border-red-200'
                        : 'btn-grass cursor-pointer hover:scale-105 active:scale-95'
                    }`}
                >
                    {!isActive && status !== 'error' && <div className="absolute inset-0 grass-texture opacity-30"></div>}
                    {isActive ? (
                        status === 'processing' || activeTool ? (
                            <Loader2 size={36} className="text-emerald-400" />
                        ) : (
                            <div className="relative flex items-center justify-center">
                                 <div className={`absolute inset-0 blur-xl opacity-30 animate-pulse ${status === 'listening' ? 'bg-emerald-500' : 'bg-brand-500'}`}></div>
                                 {status === 'listening' ? <Mic size={36} className="text-emerald-600 relative z-10" /> : <Headphones size={36} className="text-brand-500 relative z-10" />}
                            </div>
                        )
                    ) : status === 'error' ? (
                        <AlertCircle size={36} className="text-red-500" />
                    ) : status === 'connecting' ? (
                         <Loader2 size={36} className="text-white animate-spin" />
                    ) : (
                        <Mic size={36} className="text-white" />
                    )}
                </div>
                {status === 'listening' && <div className="absolute inset-0 rounded-full border-4 border-emerald-400/30 animate-ping opacity-75"></div>}
            </div>
        </div>
      </div>

      {/* Controls Area */}
      <div className="w-full p-8 pt-0 space-y-6 shrink-0 z-10">
        {status === 'idle' && lastRecordingUrl && (
            <div className="flex flex-col items-center gap-3 mb-2 animate-in fade-in slide-in-from-bottom-4">
                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest flex items-center gap-1">
                    <Save size={10} /> Interaction Saved
                </p>
                <a
                    href={lastRecordingUrl}
                    download={`interaction-${Date.now()}.wav`}
                    className="flex items-center gap-2 px-6 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-emerald-100 transition-colors border border-emerald-100 shadow-sm"
                >
                    <Download size={16} />
                    Download Recording
                </a>
            </div>
        )}

        {status === 'idle' && (
          <button 
            onClick={handleStartCall}
            className={`btn-grass w-full text-white font-bold text-sm tracking-[0.15em] uppercase py-4 rounded-xl shadow-lg transition-transform active:scale-[0.98] flex items-center justify-center gap-2`}
          >
            <Mic size={18} />
            {t.startConversation}
          </button>
        )}
        
        {isActive && (
          <div className="flex justify-center pt-4">
            <button 
              onClick={handleEndCall}
              className="group flex items-center gap-3 px-10 py-3.5 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-all shadow-sm active:scale-95 border border-red-100"
            >
              <Phone size={20} className="rotate-[135deg]" />
              <span className="text-xs font-bold uppercase tracking-[0.1em]">{t.endCall}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallTab;
