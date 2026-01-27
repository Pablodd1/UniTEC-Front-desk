import React, { useState, useEffect, useRef } from 'react';
import { Mic, Phone, AlertCircle, Loader2, CheckCircle2, Download, Headphones, Camera, CameraOff, Video as VideoIcon, Sparkles } from 'lucide-react';
import { connectLiveSession, sendMessageToGemini } from '../services/geminiService';
import { playDeepgramTTS } from '../services/deepgramService';
import AudioVisualizer from './AudioVisualizer';
import { Language, VoiceName, VoiceProvider, CallRecording } from '../types';
import { UI_TRANSLATIONS } from '../constants';
import { blobToBase64 } from '../utils/audioUtils';

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
  const [isCameraActive, setIsCameraActive] = useState(true);
  
  const [showBookingConfirmation, setShowBookingConfirmation] = useState(false);
  const [confirmedDate, setConfirmedDate] = useState<string | null>(null);
  const [lastRecordingUrl, setLastRecordingUrl] = useState<string | null>(null);

  // Refs
  const sessionControllerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIntervalRef = useRef<number | null>(null);

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
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
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

  const handleStartCall = async () => {
    setErrorMessage('');
    if (lastRecordingUrl) {
        URL.revokeObjectURL(lastRecordingUrl);
        setLastRecordingUrl(null);
    }

    setStatus('connecting');
    try {
        const session = await connectLiveSession({
            onOpen: () => {
                setStatus('connected');
                // Ensure video is visible locally
                if (videoRef.current && sessionControllerRef.current?.stream) {
                  videoRef.current.srcObject = sessionControllerRef.current.stream;
                }
                startFrameStreaming();
            },
            onMessage: () => {},
            onAudioData: (data) => setAudioData(data),
            onToolCall: () => {},
            onToolSuccess: (name, res) => {
                 if (name === 'book_appointment') {
                    setConfirmedDate(res.date || null);
                    setShowBookingConfirmation(true);
                 }
            },
            onError: (err) => {
                setErrorMessage(language === 'en' ? "Connection failed." : "Fallo de conexión.");
                setStatus('error');
            },
            onClose: () => setStatus('idle')
        }, emergencyMode, language, voiceName);
        
        if (session) {
            sessionControllerRef.current = session;
            if (videoRef.current && session.stream) {
              videoRef.current.srcObject = session.stream;
            }
        }
    } catch (e: any) {
        setErrorMessage(language === 'en' ? "Initialization error." : "Error de inicio.");
        setStatus('error');
    }
  };

  const startFrameStreaming = () => {
    if (!canvasRef.current || !videoRef.current) return;
    
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);

    frameIntervalRef.current = window.setInterval(() => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video || video.paused || video.ended || !isCameraActive) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Gemini works best with ~320px wide frames for real-time
      const scale = 320 / video.videoWidth;
      canvas.width = 320;
      canvas.height = video.videoHeight * scale;
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (blob && sessionControllerRef.current?.sendFrame) {
          const base64 = await blobToBase64(blob);
          sessionControllerRef.current.sendFrame(base64);
        }
      }, 'image/jpeg', 0.5); 
    }, 1000); 
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

  const saveToLibrary = (blob: Blob) => {
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
  };

  const toggleCamera = () => {
    const newState = !isCameraActive;
    setIsCameraActive(newState);
    if (sessionControllerRef.current?.stream) {
      const videoTrack = sessionControllerRef.current.stream.getVideoTracks()[0];
      if (videoTrack) videoTrack.enabled = newState;
    }
  };

  const isActive = status === 'connected' || status === 'listening' || status === 'speaking' || status === 'processing';

  return (
    <div className="h-full flex flex-col bg-slate-50 relative overflow-hidden font-sans">
      
      {/* Top Status Area */}
      <div className="pt-6 pb-2 text-center z-10 px-6">
        <div className="flex justify-center items-center gap-2 mb-1">
             <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.voiceTitle}</h2>
             <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100">
                <Sparkles size={10} className="text-blue-500" />
                <span className="text-[9px] text-blue-700 font-bold uppercase tracking-tight">AI Vision Active</span>
             </div>
        </div>
        <div className={`text-lg font-bold tracking-tight px-4 transition-colors duration-300 ${
            status === 'error' ? 'text-red-600' : 
            isActive ? 'text-slate-900' : 'text-slate-500'
        }`}>
          {status === 'idle' && t.tapToStart}
          {status === 'connecting' && <span className="animate-pulse">{t.connecting}</span>}
          {status === 'connected' && (language === 'en' ? "Streaming Live..." : "Transmitiendo...")}
          {status === 'error' && (errorMessage || t.connectionFailed)}
        </div>
      </div>

      {/* Main Content (Live Feed + Visualizer) */}
      <div className="flex-1 relative flex flex-col items-center justify-center min-h-[300px] p-4">
        
        {/* Hidden Canvas for frame processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Live Feed Container */}
        <div className={`relative transition-all duration-700 transform ${isActive ? 'scale-100 opacity-100 mb-6' : 'scale-75 opacity-0 pointer-events-none'}`}>
             <div className="w-64 h-64 md:w-80 md:h-80 rounded-[48px] overflow-hidden bg-slate-900 shadow-2xl border-4 border-white ring-1 ring-slate-200 relative">
                
                {/* LIVE Badge */}
                {isActive && isCameraActive && (
                  <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-red-600 text-white px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse shadow-lg">
                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                    LIVE
                  </div>
                )}

                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={`w-full h-full object-cover transition-opacity duration-500 ${isCameraActive ? 'opacity-100' : 'opacity-0'}`}
                />
                
                {!isCameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-slate-400">
                    <CameraOff size={48} className="opacity-20 mb-2" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Feed Disabled</span>
                  </div>
                )}

                {/* Visualizer overlay on bottom of video */}
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/60 to-transparent flex items-center justify-center px-8 pb-4">
                    <AudioVisualizer audioData={audioData} isActive={isActive} />
                </div>
             </div>
        </div>

        {/* Success Banner */}
        <div className={`absolute top-0 z-40 transition-all duration-500 transform w-full px-6 flex justify-center ${
            showBookingConfirmation ? 'translate-y-4 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
        }`}>
            <div className="bg-emerald-600/95 backdrop-blur-md text-white px-5 py-2.5 rounded-2xl shadow-xl flex items-center gap-3 border border-white/20">
                <CheckCircle2 size={18} />
                <div>
                   <p className="text-[11px] font-bold">{t.bookingConfirmed}</p>
                   {confirmedDate && <p className="text-[9px] opacity-80">{confirmedDate}</p>}
                </div>
            </div>
        </div>

        {!isActive && (
          <div className="relative z-10 w-full flex flex-col items-center justify-center space-y-8">
              <div className="h-[80px] w-full flex items-center justify-center px-8">
                  <AudioVisualizer audioData={audioData} isActive={isActive} />
              </div>

              {/* Main Start Button */}
              <button 
                  onClick={handleStartCall}
                  className="relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-700 shadow-2xl overflow-hidden btn-grass cursor-pointer hover:scale-105 active:scale-95"
              >
                  <div className="absolute inset-0 grass-texture opacity-30"></div>
                  {status === 'connecting' ? (
                       <Loader2 size={36} className="text-white animate-spin" />
                  ) : (
                      <Mic size={36} className="text-white" />
                  )}
              </button>
          </div>
        )}
      </div>

      {/* Controls Area */}
      <div className="w-full px-6 pb-10 pt-2 space-y-4 shrink-0 z-10">
        {status === 'idle' && lastRecordingUrl && (
            <div className="flex justify-center mb-2 animate-in fade-in slide-in-from-bottom-2">
                <a
                    href={lastRecordingUrl}
                    download={`call-${Date.now()}.wav`}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-100 text-emerald-700 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-200 transition-colors shadow-sm"
                >
                    <Download size={14} />
                    Download Call Log
                </a>
            </div>
        )}

        {status === 'idle' && (
          <button 
            onClick={handleStartCall}
            className={`btn-grass w-full text-white font-black text-xs tracking-widest uppercase py-4 rounded-2xl shadow-xl transition-all active:scale-[0.97] flex items-center justify-center gap-3`}
          >
            <VideoIcon size={18} />
            {t.startConversation}
          </button>
        )}
        
        {isActive && (
          <div className="flex justify-center items-center gap-6">
            <button 
              onClick={toggleCamera}
              className={`p-4 rounded-full transition-all shadow-lg active:scale-95 ${isCameraActive ? 'bg-white text-slate-600 hover:bg-slate-50' : 'bg-slate-800 text-white hover:bg-slate-900'}`}
            >
              {isCameraActive ? <Camera size={24} /> : <CameraOff size={24} />}
            </button>

            <button 
              onClick={handleEndCall}
              className="group flex items-center gap-3 px-10 py-4 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all shadow-xl active:scale-95 transform scale-110"
            >
              <Phone size={22} className="rotate-[135deg]" />
              <span className="text-xs font-black uppercase tracking-widest">{t.endCall}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallTab;
