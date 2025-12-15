import React, { useState, useRef, useEffect } from 'react';
import { Message, QuickAction, Language } from '../types';
import { sendMessageToGemini } from '../services/geminiService';
import { Send, Bot, User, Loader2, Box, DollarSign, Hammer, BookOpen, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { GenerateContentResponse } from '@google/genai';
import { UI_TRANSLATIONS } from '../constants';

interface ChatTabProps {
  quickActions: QuickAction[];
  initialMessage?: string;
  emergencyMode?: boolean;
  language: Language;
}

const ChatTab: React.FC<ChatTabProps> = ({ quickActions, initialMessage, emergencyMode, language }) => {
  const t = UI_TRANSLATIONS[language];
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: t.chatWelcome,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [showBookingConfirmation, setShowBookingConfirmation] = useState(false);
  const [confirmedDate, setConfirmedDate] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasProcessedInitial = useRef(false);

  // Update welcome message when language changes, but only if it's the only message
  useEffect(() => {
    if (messages.length === 1 && messages[0].id === 'welcome') {
        setMessages([{
            id: 'welcome',
            role: 'model',
            text: t.chatWelcome,
            timestamp: new Date()
        }]);
    }
  }, [language, t.chatWelcome]);

  // Check for API Key on mount
  useEffect(() => {
    if (!process.env.API_KEY) {
      setError("System Error: API Key is missing. Please contact support.");
    }
  }, []);

  useEffect(() => {
    if (initialMessage && !hasProcessedInitial.current && !isLoading && !error) {
      hasProcessedInitial.current = true;
      handleSendMessage(initialMessage);
    }
  }, [initialMessage]);

  useEffect(() => {
    if (showBookingConfirmation) {
        const timer = setTimeout(() => setShowBookingConfirmation(false), 5000);
        return () => clearTimeout(timer);
    }
  }, [showBookingConfirmation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    
    // Clear previous errors
    setError(null);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const responseGenerator = sendMessageToGemini(
          text, 
          emergencyMode, 
          language,
          (toolName, result) => {
              if (toolName === 'book_appointment') {
                  setConfirmedDate(result.date || null);
                  setShowBookingConfirmation(true);
              }
          }
      );
      
      const botMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: botMsgId,
        role: 'model',
        text: '', // Start empty
        timestamp: new Date()
      }]);

      let fullText = '';
      
      for await (const chunk of responseGenerator) {
        const c = chunk as GenerateContentResponse;
        const chunkText = c.text || '';
        fullText += chunkText;
        
        setMessages(prev => prev.map(msg => 
          msg.id === botMsgId ? { ...msg, text: fullText } : msg
        ));
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      let errorMsg = language === 'en' ? "I'm having trouble connecting. Please try again." : "Tengo problemas de conexión. Inténtalo de nuevo.";
      
      if (error.message?.includes("API_KEY_MISSING")) {
        errorMsg = language === 'en' ? "Configuration Error: API Key is missing." : "Error de Configuración: Falta la API Key.";
      }
      
      setError(errorMsg);
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: language === 'en' ? "⚠️ Connection interrupted. Please check your internet." : "⚠️ Conexión interrumpida. Revisa tu internet.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (name: string) => {
    switch(name) {
      case 'Box': return <Box size={16} />;
      case 'DollarSign': return <DollarSign size={16} />;
      case 'Hammer': return <Hammer size={16} />;
      case 'BookOpen': return <BookOpen size={16} />;
      default: return <Box size={16} />;
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      
      {/* Success Banner Overlay */}
      <div className={`absolute top-4 left-4 right-4 z-50 transition-all duration-500 transform ${showBookingConfirmation ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'}`}>
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl shadow-lg flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
                <CheckCircle2 size={24} />
            </div>
            <div>
                <p className="font-bold text-sm">Success</p>
                <p className="text-xs">{t.bookingConfirmed}</p>
                {confirmedDate && (
                  <p className="text-xs font-bold mt-1 text-emerald-700">{confirmedDate}</p>
                )}
            </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar relative">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-brand-500 text-white' : 'bg-brand-900 text-accent-500'
              }`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div 
                className={`p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-brand-500 text-white rounded-br-none' 
                    : 'bg-white text-gray-800 rounded-bl-none border border-gray-100'
                }`}
              >
                 {msg.text.split('\n').map((line, i) => (
                    <p key={i} className={i > 0 ? 'mt-2' : ''}>{line}</p>
                 ))}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
             <div className="flex max-w-[85%] items-end gap-2">
                <div className="w-8 h-8 rounded-full bg-brand-900 text-accent-500 flex items-center justify-center shrink-0">
                  <Bot size={16} />
                </div>
                <div className="bg-white p-3 rounded-2xl rounded-bl-none border border-gray-100 shadow-sm">
                  <Loader2 className="animate-spin text-brand-500" size={18} />
                </div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-4 pb-2">
          <div className="bg-red-50 border border-red-100 text-red-700 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-4 py-2">
         <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {quickActions.map(action => (
              <button
                key={action.id}
                onClick={() => handleSendMessage(action.message)}
                disabled={isLoading || !!error}
                className="flex items-center gap-2 whitespace-nowrap bg-white border border-brand-100 px-3 py-2 rounded-full text-xs font-medium text-brand-700 hover:bg-brand-50 hover:border-brand-300 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {getIcon(action.iconName)}
                {action.title}
              </button>
            ))}
         </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-100">
        <div className={`flex items-center gap-2 bg-gray-50 p-2 rounded-xl border transition-all ${
          error ? 'border-red-200' : 'border-gray-200 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500'
        }`}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputText)}
            placeholder={error ? (language === 'en' ? "Chat disabled" : "Chat deshabilitado") : t.chatPlaceholder}
            className="flex-1 bg-transparent border-none outline-none text-sm px-2 text-gray-800 placeholder-gray-400 disabled:text-gray-400"
            disabled={isLoading || !!error}
          />
          <button 
            onClick={() => handleSendMessage(inputText)}
            disabled={!inputText.trim() || isLoading || !!error}
            className={`p-2 rounded-lg transition-colors ${
              inputText.trim() && !isLoading && !error
                ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-md' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatTab;