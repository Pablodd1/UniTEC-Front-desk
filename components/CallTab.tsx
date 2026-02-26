
import React, { useState, useEffect, useRef } from 'react';
import { Mic, Phone, Loader2, CheckCircle2, Download, Headphones, Camera, CameraOff, Video as VideoIcon, Sparkles } from 'lucide-react';
import { connectLiveSession, sendMessageToGemini } from '../services/geminiService';
import { playElevenLabsTTS } from '../services/elevenLabsService';
import AudioVisualizer from './AudioVisualizer';
import { Language, VoiceName, VoiceProvider, CallRecording } from '../types';
import { UI_TRANSLATIONS } from '../constants';
import { blobToBase64 } from '../utils/audioUtils';
import { GenerateContentResponse } from '@google/genai';

interface CallTabProps {
  emergencyMode?: boolean;
  language: Language;
  voiceName: VoiceName;
  voiceProvider: VoiceProvider;
  deepgramKey?: string;
  customGreeting?: string;
}

const CallTab: React.FC<CallTabProps> = ({ emergencyMode, language, voiceName, voiceProvider, customGreeting }) => {
  const t = UI_TRANSLATIONS[language];
  
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error' | 'listening' | 'processing' | 'speaking'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [audioData, setAudioData] = useState<Uint8Array>(new Uint8Array(64));
  const [isCameraActive, setIsCameraActive] = useState(true);
  
  const [showBookingConfirmation, setShowBookingConfirmation] = useState(false);
  const [confirmedDate, setConfirmedDate] = useState<string | null>(null);
  const [lastRecordingUrl, setLastRecordingUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [callLibrary, setCallLibrary] = useState<CallRecording[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);

  // Gemini Live API Refs
  const sessionControllerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIntervalRef = useRef<number | null>(null);

  // Hybrid Mode (ElevenLabs/Cloned Voice) Refs
  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const elevenLabsKey = localStorage.getItem('unitec_elevenlabs_key') || '';

  useEffect(() => {
    const stored = localStorage.getItem('unitec_call_library') || '[]';
    setCallLibrary(JSON.parse(stored));

    return () => {
      stopAll();
    };
  }, []);

  const stopAll = async () => {
    // Clear Intervals
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    // Cancel Animations
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
    }
    // Stop Live Session
    if (sessionControllerRef.current) {
      await sessionControllerRef.current.disconnect();
      sessionControllerRef.current = null;
    }
    // Stop Recognition (Hybrid)
    if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
    }
    // Stop Audio Playback (Hybrid)
    if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
    }
    // Close Audio Context
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
    if (analyserRef.current) {
        try { analyserRef.current.disconnect(); } catch(e) {}
    }
    
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyserRef.current = analyser;

    let source;
    try {
        if (stream instanceof MediaStream) {
            source = ctx.createMediaStreamSource(stream);
        } else {
            source = ctx.createMediaElementSource(stream);
            source.connect(ctx.destination);
        }
        source.connect(analyser);
    } catch (e) {
        console.warn("Visualizer connection error", e);
        return;
    }

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
    setTranscript([]);
    if (lastRecordingUrl) {
        URL.revokeObjectURL(lastRecordingUrl);
        setLastRecordingUrl(null);
    }

    setStatus('connecting');

    // 1. If using Gemini Native Voice -> Use Live API (WebSocket)
    if (voiceProvider === 'gemini') {
        try {
            const session = await connectLiveSession({
                onOpen: () => {
                    setStatus('connected');
                    if (videoRef.current && sessionControllerRef.current?.stream) {
                    videoRef.current.srcObject = sessionControllerRef.current.stream;
                    }
                    startFrameStreaming();
                },
                onMessage: (text) => {
                    if (text) {
                        setTranscript(prev => {
                            // Simple logic to avoid duplicate consecutive messages from model if they come in chunks
                            // Though Live API usually sends full turns or clear markers
                            const last = prev[prev.length - 1];
                            if (last && last.role === 'model' && last.text === text) return prev;
                            return [...prev, { role: 'model', text }];
                        });
                    }
                },
                onAudioData: (data) => setAudioData(data),
                onToolCall: () => {},
                onToolSuccess: (name, res) => {
                    if (name === 'book_appointment') {
                        setConfirmedDate(res.date || null);
                        setShowBookingConfirmation(true);
                    }
                },
                onError: () => {
                    setErrorMessage(language === 'en' ? "Connection failed." : "Fallo de conexión.");
                    setStatus('error');
                },
                onClose: () => setStatus('idle')
            }, emergencyMode, language, voiceName, customGreeting);
            
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
    } 
    // 2. If using ElevenLabs (Cloned) -> Use Hybrid Loop (STT -> LLM -> TTS)
    else {
        startHybridCall();
    }
  };

  // Logic for Cloned Voice Hybrid Mode
  const startHybridCall = async () => {
    try {
        // Init Camera for visual effect
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setErrorMessage("Browser not compatible with Voice Cloning mode.");
            setStatus('error');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false; // We want turn-taking
        recognition.lang = language === 'en' ? 'en-US' : 'es-ES';
        recognition.interimResults = false;

        recognition.onstart = () => {
            setStatus('listening');
            startVisualizer(stream); // Visualize mic
        };

        recognition.onresult = async (event: any) => {
            const transcriptText = event.results[0][0].transcript;
            console.log("User said:", transcriptText);
            setTranscript(prev => [...prev, { role: 'user', text: transcriptText }]);
            setStatus('processing');
            
            // Send to Gemini as Text
            const responseGen = sendMessageToGemini(transcriptText, emergencyMode, language, (name, res) => {
                if (name === 'book_appointment') {
                    setConfirmedDate(res.date || null);
                    setShowBookingConfirmation(true);
                }
            }, customGreeting);

            let fullText = "";
            for await (const chunk of responseGen) {
                 const c = chunk as GenerateContentResponse;
                 if (c.text) fullText += c.text;
            }

            if (fullText) {
                setTranscript(prev => [...prev, { role: 'model', text: fullText }]);
                setStatus('speaking');
                // Send to ElevenLabs
                const audio = await playElevenLabsTTS(
                    fullText, 
                    elevenLabsKey, 
                    voiceName, 
                    () => { 
                        if(currentAudioRef.current) startVisualizer(currentAudioRef.current);
                    },
                    () => {
                        // After speaking, listen again
                        if (status !== 'idle') {
                            try { recognition.start(); } catch(e){}
                        }
                    }
                );
                currentAudioRef.current = audio || null;
            } else {
                 try { recognition.start(); } catch(e){}
            }
        };

        recognition.onerror = (e: any) => {
            console.error("STT Error", e);
            // Restart if no speech detected
            if (e.error === 'no-speech') {
                 try { recognition.start(); } catch(e){}
            }
        };

        recognitionRef.current = recognition;
        setStatus('connected');
        
        // Speak Greeting First
        if (customGreeting) {
            setStatus('speaking');
             const audio = await playElevenLabsTTS(
                customGreeting, 
                elevenLabsKey, 
                voiceName,
                () => { if(currentAudioRef.current) startVisualizer(currentAudioRef.current); },
                () => { recognition.start(); }
            );
            currentAudioRef.current = audio || null;
        } else {
            recognition.start();
        }

    } catch (e) {
        setErrorMessage("Microphone/Camera access required.");
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
    const currentTranscript = transcript.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
    if (sessionControllerRef.current) {
      const blob = sessionControllerRef.current.getAudioBlob();
      if (blob.size > 100) {
          const url = URL.createObjectURL(blob);
          setLastRecordingUrl(url);
          saveToLibrary(blob, currentTranscript);
      }
    } else if (transcript.length > 0) {
        // For hybrid mode or if session ended but transcript exists
        saveToLibrary(new Blob(), currentTranscript);
    }
    await stopAll();
    setStatus('idle');
  };

  const saveToLibrary = (_blob: Blob, transcriptText?: string) => {
    const id = Date.now().toString();
    const newRecording: CallRecording = {
        id,
        name: `Call_${id.slice(-4)}.wav`,
        timestamp: new Date().toISOString(),
        duration: "0:30",
        transcript: transcriptText
    };
    const stored = localStorage.getItem('unitec_call_library') || '[]';
    const library = JSON.parse(stored);
    library.unshift(newRecording);
    localStorage.setItem('unitec_call_library', JSON.stringify(library));
    setCallLibrary(library);
  };

  const toggleCamera = () => {
    const newState = !isCameraActive;
    setIsCameraActive(newState);
    if (sessionControllerRef.current?.stream) {
      const videoTrack = sessionControllerRef.current.stream.getVideoTracks()[0];
      if (videoTrack) videoTrack.enabled = newState;
    }
  };

  const isActive = status !== 'idle' && status !== 'error' && status !== 'connecting';

  return (
    <div className="h-full flex flex-col bg-slate-50 relative overflow-hidden font-sans">
      
      {/* Top Status Area */}
      <div className="pt-6 pb-2 text-center z-10 px-6">
        <div className="flex justify-center items-center gap-2 mb-1">
             <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.voiceTitle}</h2>
             {voiceProvider === 'gemini' && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100">
                    <Sparkles size={10} className="text-blue-500" />
                    <span className="text-[9px] text-blue-700 font-bold uppercase tracking-tight">AI Vision Active</span>
                </div>
             )}
             {voiceProvider === 'elevenlabs' && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100">
                    <Headphones size={10} className="text-indigo-500" />
                    <span className="text-[9px] text-indigo-700 font-bold uppercase tracking-tight">Cloned Voice Mode</span>
                </div>
             )}
        </div>
        <div className={`text-lg font-bold tracking-tight px-4 transition-colors duration-300 ${
            status === 'error' ? 'text-red-600' : 
            isActive ? 'text-slate-900' : 'text-slate-500'
        }`}>
          {status === 'idle' && t.tapToStart}
          {status === 'connecting' && <span className="animate-pulse">{t.connecting}</span>}
          {status === 'connected' && (language === 'en' ? "Ready" : "Listo")}
          {status === 'listening' && (language === 'en' ? "Listening..." : "Escuchando...")}
          {status === 'processing' && (language === 'en' ? "Thinking..." : "Pensando...")}
          {status === 'speaking' && (language === 'en' ? "Speaking..." : "Hablando...")}
          {status === 'error' && (errorMessage || t.connectionFailed)}
        </div>
      </div>

      {/* Main Content (Live Feed + Visualizer + Transcript) */}
      <div className="flex-1 relative flex flex-col items-center justify-center min-h-[300px] p-4 overflow-y-auto no-scrollbar">
        
        {/* Hidden Canvas for frame processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Live Feed Container */}
        <div className={`relative transition-all duration-700 transform ${isActive ? 'scale-100 opacity-100 mb-6' : 'scale-75 opacity-0 pointer-events-none absolute'}`}>
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

        {/* Live Transcript View */}
        {isActive && transcript.length > 0 && (
            <div className="w-full max-w-md bg-white/60 backdrop-blur-sm rounded-3xl p-4 border border-white/50 shadow-sm mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2 mb-3 border-bottom border-slate-100 pb-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Transcript</span>
                </div>
                <div className="space-y-3 max-h-32 overflow-y-auto no-scrollbar">
                    {transcript.slice(-3).map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] px-3 py-1.5 rounded-2xl text-[11px] leading-relaxed ${
                                msg.role === 'user' ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 shadow-sm border border-slate-100'
                            }`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Booking Confirmation Modal */}
        {showBookingConfirmation && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white rounded-[40px] p-8 shadow-2xl border border-slate-100 max-w-xs w-full text-center animate-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-emerald-50">
                        <CheckCircle2 size={40} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">Confirmed!</h3>
                    <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                        {t.bookingConfirmed}
                    </p>
                    {confirmedDate && (
                        <div className="bg-slate-50 rounded-2xl p-4 mb-8 border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Appointment Details</p>
                            <p className="text-slate-900 font-bold text-sm">{confirmedDate}</p>
                        </div>
                    )}
                    <button 
                        onClick={() => setShowBookingConfirmation(false)}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
                    >
                        Great, thanks!
                    </button>
                </div>
            </div>
        )}

        {!isActive && !showLibrary && (
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

        {/* Call Library / History Section */}
        {!isActive && showLibrary && (
            <div className="w-full max-w-md bg-white rounded-[40px] p-6 shadow-xl border border-slate-100 animate-in slide-in-from-bottom-8 duration-500">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Call History</h3>
                    <button onClick={() => setShowLibrary(false)} className="text-slate-400 hover:text-slate-600">
                        <Loader2 size={18} className="rotate-45" />
                    </button>
                </div>
                
                {callLibrary.length === 0 ? (
                    <div className="py-12 text-center">
                        <Headphones size={40} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-slate-400 text-xs font-medium">No recorded calls yet.</p>
                    </div>
                ) : (
                    <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
                        {callLibrary.map((rec) => (
                            <div key={rec.id} className="bg-slate-50 rounded-3xl p-4 border border-slate-100 group hover:border-brand-200 transition-all">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-brand-600 shadow-sm">
                                            <Phone size={18} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-900">{rec.name}</p>
                                            <p className="text-[10px] text-slate-400">{new Date(rec.timestamp).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button className="p-2 rounded-xl bg-white text-slate-600 hover:text-brand-600 shadow-sm border border-slate-100">
                                            <Download size={14} />
                                        </button>
                                    </div>
                                </div>
                                {rec.transcript && (
                                    <div className="mt-3 pt-3 border-t border-slate-200/50">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Transcript Preview</p>
                                        <p className="text-[10px] text-slate-600 line-clamp-2 italic leading-relaxed">
                                            "{rec.transcript.split('\n')[0].replace('USER: ', '').replace('MODEL: ', '')}"
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Controls Area */}
      <div className="w-full px-6 pb-10 pt-2 space-y-4 shrink-0 z-10">
        {status === 'idle' && !showLibrary && (
            <div className="flex justify-center mb-2 animate-in fade-in slide-in-from-bottom-2">
                <button
                    onClick={() => setShowLibrary(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-600 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors shadow-sm border border-slate-200"
                >
                    <Headphones size={14} />
                    View Call Library ({callLibrary.length})
                </button>
            </div>
        )}

        {status === 'idle' && !showLibrary && (
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
