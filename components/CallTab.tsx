// @ts-nocheck\n
import React, { useState, useEffect, useRef } from 'react';
import { Mic, Phone, Loader2, CheckCircle2, Download, Headphones } from 'lucide-react';
import { connectLiveSession } from '../services/geminiService';
import { saveChatSession } from '../services/firestoreService';
import { summarizeSessionNow } from '../services/retentionService';
import { Language, VoiceName, VoiceProvider, CallRecording } from '../types';
import { UI_TRANSLATIONS } from '../constants';
import { createConversation, addMessage } from '../services/conversationService';

interface CallTabProps {
  emergencyMode?: boolean;
  language: Language;
  voiceName: VoiceName;
  voiceProvider: VoiceProvider;
  customGreeting?: string;
  brandId?: 'unitec' | 'building';
}

const CallTab: React.FC<CallTabProps> = ({ emergencyMode, language, voiceName, customGreeting, brandId }) => {
  const t = UI_TRANSLATIONS[language];
  
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error' | 'listening' | 'processing' | 'speaking'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  const [showBookingConfirmation, setShowBookingConfirmation] = useState(false);
  const [confirmedDate, setConfirmedDate] = useState<string | null>(null);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [lastRecordingUrl, setLastRecordingUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [callLibrary, setCallLibrary] = useState<CallRecording[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  
  // ===== NEW: Conversation Tracking =====
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Gemini Live API Refs
  const sessionControllerRef = useRef<any>(null);

  // Audio Context Refs for Visualizer
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('unitec_call_library') || '[]';
    setCallLibrary(JSON.parse(stored));

    return () => {
      stopAll();
    };
  }, []);

  useEffect(() => {
    if (showEmailConfirmation) {
        const timer = setTimeout(() => setShowEmailConfirmation(false), 8000);
        return () => clearTimeout(timer);
    }
  }, [showEmailConfirmation]);

  // ===== NEW: Save call transcript to conversation tracking =====
  useEffect(() => {
    if (!conversationId || transcript.length === 0) return;
    
    const lastMsg = transcript[transcript.length - 1];
    if (lastMsg.text) {
      addMessage(conversationId, {
        role: lastMsg.role === 'user' ? 'user' : 'model',
        text: lastMsg.text,
      }).catch((e: any) => console.warn('Failed to save call message:', e));
    }
  }, [transcript, conversationId]);

  const stopAll = async () => {
    // Cancel Animations
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
    }
    // Stop Live Session
    if (sessionControllerRef.current) {
      await sessionControllerRef.current.disconnect();
      sessionControllerRef.current = null;
    }
    // Close Audio Context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };


  const handleStartCall = async () => {
    setErrorMessage('');
    setTranscript([]);
    if (lastRecordingUrl) {
        URL.revokeObjectURL(lastRecordingUrl);
        setLastRecordingUrl(null);
    }

    setStatus('connecting');
    
    // ===== NEW: Initialize conversation session for this call =====
    createConversation(brandId || 'unitec', language, 'phone')
      .then(convId => setConversationId(convId))
      .catch(e => console.warn('Failed to create conversation for call:', e));

    try {
        const session = await connectLiveSession({
            onOpen: () => {
                setStatus('connected');
            },
            onStatusChange: (newStatus: any) => {
                setStatus(newStatus);
            },
            onMessage: (text: string | null) => {
                if (text) {
                    setTranscript(prev => {
                        const last = prev[prev.length - 1];
                        if (last && last.role === 'model' && last.text === text) return prev;
                        return [...prev, { role: 'model', text }];
                    });
                }
            },
            onAudioData: () => {},
            onToolCall: () => {},
            onToolSuccess: (name: string, res: any) => {
                if (name === 'book_appointment') {
                    setConfirmedDate(res.date || null);
                    setShowBookingConfirmation(true);
                } else if (name === 'send_email') {
                    setEmailSentTo(res.customerEmail || null);
                    setShowEmailConfirmation(true);
                } else if (name === 'email_conversation_to_admin') {
                    setEmailSentTo('Administrator');
                    setShowEmailConfirmation(true);
                }
            },
                        onError: (err: any) => {
                const isLocalKeyUsed = typeof window !== 'undefined' && !!window.localStorage.getItem('unitec_gemini_api_key');
                const errMsg = err?.message || String(err);
                let msg = language === 'en' ? `Connection failed (${errMsg}).` : `Fallo de conexión (${errMsg}).`;
                if (isLocalKeyUsed) {
                    msg += language === 'en' ? " (Using local Admin key override)" : " (Usando clave local de Administrador)";
                }
                setErrorMessage(msg);
                setStatus('error');
            },
            onClose: () => setStatus('idle')
        }, emergencyMode, language, voiceName, customGreeting, brandId);
        
        if (session) {
            sessionControllerRef.current = session;
        }
    } catch (e: any) {
        const isLocalKeyUsed = typeof window !== 'undefined' && !!window.localStorage.getItem('unitec_gemini_api_key');
        const errMsg = e?.message || String(e);
        let msg = language === 'en' ? `Initialization error (${errMsg}).` : `Error de inicio (${errMsg}).`;
        if (isLocalKeyUsed) {
            msg += language === 'en' ? " (Using local Admin key override)" : " (Usando clave local de Administrador)";
        }
        setErrorMessage(msg);
        setStatus('error');
    }
  };



  // ===== Silence / Inactivity Timer (30s) & Hard Max Call Limit (5m) =====
  useEffect(() => {
    if (status !== 'connected' && status !== 'listening' && status !== 'speaking' && status !== 'processing') return;

    // 1. Hard maximum limit of 5 minutes to prevent infinite calls
    const maxCallTimer = setTimeout(() => {
      console.log('Call reached 5 minutes limit. Ending call.');
      handleEndCall();
    }, 5 * 60 * 1000);

    // 2. Silence/Inactivity detection: close call if user does not speak/answer for 30 seconds
    const lastMsg = transcript[transcript.length - 1];
    const isWaitingForUser = !lastMsg || lastMsg.role === 'model';
    let silenceTimer: NodeJS.Timeout | null = null;

    if (isWaitingForUser) {
      silenceTimer = setTimeout(() => {
        console.log('No user response for 30 seconds. Auto-hanging up.');
        handleEndCall();
      }, 30 * 1000); // 30 seconds silence timeout
    }

    return () => {
      clearTimeout(maxCallTimer);
      if (silenceTimer) clearTimeout(silenceTimer);
    };
  }, [transcript, status]);

  const handleEndCall = async () => {
    const currentTranscript = transcript.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
    
    if (transcript.length > 0) {
        saveChatSession({
          id: conversationId || `call_${Date.now()}`,
          timestamp: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          messages: transcript.map(m => ({
            id: Date.now().toString() + Math.random().toString(),
            role: m.role,
            text: m.text,
            timestamp: new Date()
          })),
          customerName: 'Anonymous Caller', // No PII extracted in calls yet
          status: 'completed',
          type: 'call'
        }).catch(e => console.warn('Sync warning', e));
    }

    if (conversationId) {
        summarizeSessionNow(conversationId).catch(console.error);
    }

    if (sessionControllerRef.current) {
      const blob = sessionControllerRef.current.getAudioBlob();
      if (blob.size > 100) {
          const url = URL.createObjectURL(blob);
          setLastRecordingUrl(url);
          saveToLibrary(blob, currentTranscript);
      }
    } else if (transcript.length > 0) {
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



  const isActive = status !== 'idle' && status !== 'error' && status !== 'connecting';

  return (
    <div className="h-full flex flex-col bg-slate-50 relative overflow-hidden font-sans">
      
      {/* Top Status Area */}
      <div className="pt-6 pb-2 text-center z-10 px-6">
        <div className="flex justify-center items-center gap-2 mb-1">
             <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.voiceTitle}</h2>
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

      {/* Main Content (Visualizer + Transcript) */}
      <div className="flex-1 relative flex flex-col items-center justify-center min-h-[300px] p-4 overflow-y-auto no-scrollbar">
        
        {/* Sleek Pulsing Microphone Accent */}
        <div className={`relative transition-all duration-700 transform ${isActive ? 'scale-100 opacity-100 mb-8' : 'scale-75 opacity-0 pointer-events-none absolute'} flex flex-col items-center justify-center`}>
             <div className="relative w-44 h-44 rounded-full bg-brand-500/10 flex items-center justify-center">
                <div className="absolute inset-0 bg-brand-500/20 rounded-full animate-ping pointer-events-none scale-150 duration-[2500ms]"></div>
                <div className="absolute inset-x-[-12px] inset-y-[-12px] bg-brand-500/10 rounded-full animate-pulse pointer-events-none"></div>
                <div className="w-32 h-32 rounded-full bg-brand-600 flex items-center justify-center shadow-2xl border-4 border-white relative">
                  <Mic size={48} className="text-white animate-bounce duration-[2000ms]" />
                </div>
             </div>
             
             <div className="flex items-center gap-1.5 mt-6 px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-full tracking-wider animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {status === 'speaking' ? (language === 'en' ? 'Speaking...' : 'Hablando...') : 
                 status === 'listening' ? (language === 'en' ? 'Listening...' : 'Escuchando...') : 
                 status === 'processing' ? (language === 'en' ? 'Thinking...' : 'Pensando...') : 
                 (language === 'en' ? 'Receiving Call' : 'Llamada Activa')}
             </div>
        </div>

        {/* Live Transcript View */}
        {isActive && transcript.length > 0 && (
            <div className="w-full max-w-md bg-white/60 backdrop-blur-sm rounded-3xl p-4 border border-white/50 shadow-sm mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2 mb-3 border-bottom border-slate-100 pb-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{language === 'en' ? 'Live Transcript' : 'Transcripción en Vivo'}</span>
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

        {/* Email Confirmation Modal */}
        {showEmailConfirmation && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white rounded-[40px] p-8 shadow-2xl border border-slate-100 max-w-xs w-full text-center animate-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-blue-50">
                        <CheckCircle2 size={40} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">{language === 'en' ? 'Email Sent!' : '¡Correo Enviado!'}</h3>
                    <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                        {language === 'en' ? 'The requested files have been sent.' : 'Los archivos solicitados han sido enviados.'}
                    </p>
                    {emailSentTo && (
                        <div className="bg-slate-50 rounded-2xl p-4 mb-8 border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{language === 'en' ? 'Sent to' : 'Enviado a'}</p>
                            <p className="text-slate-900 font-bold text-sm truncate">{emailSentTo}</p>
                        </div>
                    )}
                    <button 
                        onClick={() => setShowEmailConfirmation(false)}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
                    >
                        {t.greatThanks}
                    </button>
                </div>
            </div>
        )}        {!isActive && !showLibrary && (
          <div className="relative z-10 w-full flex flex-col items-center justify-center space-y-6 my-6">
              {/* Single Beautiful Pulsing Microphone Button to Start Conversation */}
              <button 
                  onClick={handleStartCall}
                  className="relative w-40 h-40 rounded-full flex items-center justify-center transition-all duration-700 shadow-2xl overflow-hidden bg-brand-600 hover:bg-brand-700 cursor-pointer hover:scale-105 active:scale-95 group"
              >
                  <div className="absolute inset-0 bg-brand-500/20 rounded-full animate-ping pointer-events-none scale-110 duration-[3000ms]"></div>
                  <div className="absolute inset-x-[-8px] inset-y-[-8px] bg-brand-500/10 rounded-full animate-pulse pointer-events-none"></div>
                  <div className="absolute inset-0 grass-texture opacity-30"></div>
                  {status === 'connecting' ? (
                       <Loader2 size={44} className="text-white animate-spin" />
                  ) : (
                       <Mic size={44} className="text-white group-hover:scale-110 transition-transform" />
                  )}
              </button>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 block select-none">
                  {language === 'en' ? 'Tap Microphone to Speak' : 'Toca el Micrófono para Hablar'}
              </div>
          </div>
        )}

        {/* Call Library / History Section */}
        {!isActive && showLibrary && (
            <div className="w-full max-w-md bg-white rounded-[40px] p-6 shadow-xl border border-slate-100 animate-in slide-in-from-bottom-8 duration-500">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{language === 'en' ? 'Call History' : 'Historial de Llamadas'}</h3>
                    <button onClick={() => setShowLibrary(false)} className="text-slate-400 hover:text-slate-600">
                        <Loader2 size={18} className="rotate-45" />
                    </button>
                </div>
                
                {callLibrary.length === 0 ? (
                    <div className="py-12 text-center">
                        <Headphones size={40} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-slate-400 text-xs font-medium">{language === 'en' ? 'No recorded calls yet.' : 'Sin llamadas grabadas aún.'}</p>
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
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{language === 'en' ? 'Transcript Preview' : 'Vista Previa de Transcripción'}</p>
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
                    {language === 'en' ? `View Call Library (${callLibrary.length})` : `Ver Historial (${callLibrary.length})`}
                </button>
            </div>
        )}

        {status === 'idle' && !showLibrary && (
          <button 
            onClick={handleStartCall}
            className={`btn-grass w-full text-white font-black text-xs tracking-widest uppercase py-4 rounded-2xl shadow-xl transition-all active:scale-[0.97] flex items-center justify-center`}
          >
            {t.startConversation}
          </button>
        )}
        
        {isActive && (
          <div className="flex justify-center items-center gap-6">
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
