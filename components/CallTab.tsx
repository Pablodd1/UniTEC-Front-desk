import React, { useState, useEffect, useRef } from 'react';
import { Mic, Phone, AlertCircle, Mail, CalendarCheck } from 'lucide-react';
import { connectLiveSession } from '../services/geminiService';
import AudioVisualizer from './AudioVisualizer';

interface CallTabProps {
  emergencyMode?: boolean;
}

const CallTab: React.FC<CallTabProps> = ({ emergencyMode }) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [audioData, setAudioData] = useState<Uint8Array>(new Uint8Array(64));
  const [activeTool, setActiveTool] = useState<string | null>(null);
  
  const disconnectRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    return () => {
      if (disconnectRef.current) {
        disconnectRef.current();
      }
    };
  }, []);

  // Clear tool status after delay
  useEffect(() => {
    if (activeTool) {
      const timer = setTimeout(() => setActiveTool(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [activeTool]);

  const mapErrorToUserMessage = (error: Error): string => {
    const msg = error.message;
    if (msg.includes("API_KEY_MISSING")) return "Configuration Error: API Key missing.";
    if (msg.includes("MIC_PERMISSION_DENIED")) return "Microphone access denied. Please allow microphone access in your browser settings.";
    if (msg.includes("MIC_NOT_FOUND")) return "No microphone found. Please connect a device.";
    if (msg.includes("CONNECTION_ERROR")) return "Connection lost. Please check your internet.";
    return "An unexpected error occurred. Please try again.";
  };

  const handleStartCall = async () => {
    setStatus('connecting');
    setErrorMessage('');

    try {
      const session = await connectLiveSession({
        onOpen: () => {
          setStatus('connected');
        },
        onMessage: (text, audioBuffer, interrupted) => {
           // handled by service, mainly
        },
        onAudioData: (data) => {
            setAudioData(data);
        },
        onToolCall: (toolName) => {
            setActiveTool(toolName);
        },
        onError: (err) => {
          console.error("Live Session Error:", err);
          setErrorMessage(mapErrorToUserMessage(err));
          setStatus('error');
        },
        onClose: () => {
          setStatus('idle');
        }
      }, emergencyMode);

      if (!session) {
        // connectLiveSession returns null if immediate error occurs (like API key missing)
        return;
      }

      disconnectRef.current = session.disconnect;

    } catch (e: any) {
      console.error(e);
      setErrorMessage(mapErrorToUserMessage(e));
      setStatus('error');
    }
  };

  const handleEndCall = async () => {
    if (disconnectRef.current) {
      await disconnectRef.current();
      disconnectRef.current = null;
    }
    setStatus('idle');
  };

  const suggestions = [
    "¿Tienen stock inmediato en Florida?",
    "Tell me about the 20% off combo packages",
    "¿Cómo funciona el sistema de instalación PEGATEC?",
    "Book an appointment for a wholesale quote",
    "Necesito una cotización mayorista"
  ];

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-brand-50 to-white relative overflow-hidden">
      
      {/* Top Status */}
      <div className="pt-8 pb-4 text-center space-y-2 shrink-0 z-10 px-6">
        <h2 className="text-2xl font-bold text-brand-900">Voice Assistant</h2>
        <p className={`text-sm font-medium transition-colors ${status === 'error' ? 'text-red-500' : 'text-brand-600/80'}`}>
          {status === 'idle' && "Tap the microphone to start"}
          {status === 'connecting' && "Connecting securely..."}
          {status === 'connected' && "Live Conversation"}
          {status === 'error' && "Connection Failed"}
        </p>
      </div>

      {/* Visualizer / Centerpiece */}
      <div className="flex-1 relative flex flex-col items-center justify-center min-h-[250px]">
        
        {/* Tool Activity Toast */}
        {activeTool && (
            <div className="absolute top-4 z-20 animate-fade-in-down">
                <div className="bg-brand-900 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm">
                    {activeTool === 'book_appointment' ? (
                        <><CalendarCheck size={16} className="text-green-400" /> Confirming Appointment...</>
                    ) : activeTool === 'log_to_crm' ? (
                        <><Mail size={16} className="text-blue-400" /> Saving to CRM...</>
                    ) : (
                        <span>Processing request...</span>
                    )}
                </div>
            </div>
        )}

        <div className="relative z-10 w-full flex flex-col items-center justify-center space-y-8">
            {/* The Visualizer */}
            <div className="h-[120px] w-full flex items-center justify-center px-8">
                <AudioVisualizer audioData={audioData} isActive={status === 'connected'} />
            </div>

            {/* Mic Button */}
            <div className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${
            status === 'connected' 
                ? 'bg-white border-4 border-brand-500 scale-110' 
                : status === 'error' 
                ? 'bg-red-50 border-4 border-red-200'
                : 'bg-gradient-to-tr from-brand-600 to-brand-400 cursor-pointer hover:scale-105'
            }`}>
            {status === 'connected' ? (
                 <Mic size={32} className="text-brand-500" />
            ) : status === 'error' ? (
                <AlertCircle size={32} className="text-red-500" />
            ) : status === 'connecting' ? (
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            ) : (
                <Mic size={32} className="text-white" />
            )}
            </div>
        </div>
      </div>

      {/* Controls */}
      <div className="w-full p-8 pt-0 space-y-6 shrink-0 z-10">
        
        {/* Suggestions */}
        {status === 'idle' && (
          <div className="space-y-3 mb-2">
            <p className="text-xs text-center text-gray-400 font-medium uppercase tracking-wider">Try asking</p>
            <div className="grid grid-cols-1 gap-2">
              {suggestions.map((s, i) => (
                <div key={i} className="bg-white/60 backdrop-blur border border-brand-100 p-3 rounded-xl text-sm text-brand-800 text-center shadow-sm cursor-default hover:bg-white/80 transition-colors">
                  "{s}"
                </div>
              ))}
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl text-center flex flex-col items-center gap-2">
            <AlertCircle size={20} />
            <span className="font-medium">{errorMessage}</span>
            <button 
                onClick={() => setStatus('idle')}
                className="mt-1 text-xs underline text-red-800 hover:text-red-900"
            >
                Try Again
            </button>
          </div>
        )}

        {status === 'idle' && (
          <button 
            onClick={handleStartCall}
            className="w-full bg-brand-600 text-white font-semibold py-4 rounded-xl shadow-lg hover:bg-brand-700 transition-transform active:scale-95"
          >
            Start Conversation
          </button>
        )}
        
        {status === 'connecting' && (
             <button 
             className="w-full bg-brand-400 text-white font-semibold py-4 rounded-xl shadow-lg cursor-wait"
             disabled
           >
             Connecting...
           </button>
        )}

        {status === 'connected' && (
          <div className="flex justify-center">
            <button 
              onClick={handleEndCall}
              className="bg-red-500 text-white p-4 rounded-full shadow-lg hover:bg-red-600 transition-transform active:scale-95 animate-pulse"
              aria-label="End Call"
            >
              <Phone size={32} className="rotate-[135deg]" />
            </button>
          </div>
        )}
        
        {status !== 'idle' && status !== 'error' && (
          <p className="text-xs text-center text-gray-400">
            Secure 256-bit Encrypted Connection
          </p>
        )}
      </div>
    </div>
  );
};

export default CallTab;