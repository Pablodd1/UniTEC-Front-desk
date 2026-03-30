
import React, { useState, useRef, useEffect } from 'react';
import { Message, QuickAction, Language } from '../types';
import { sendMessageToGemini } from '../services/geminiService';
import { Send, Bot, User, Box, DollarSign, Hammer, BookOpen, CheckCircle2, Truck, FileText, RefreshCcw, Percent } from 'lucide-react';
import { GenerateContentResponse } from '@google/genai';
import { UI_TRANSLATIONS } from '../constants';
import Markdown from 'react-markdown';

interface ChatTabProps {
  quickActions: QuickAction[];
  initialMessage?: string;
  emergencyMode?: boolean;
  language: Language;
  customGreeting?: string;
  bgImage?: string;
}

const ChatTab: React.FC<ChatTabProps> = ({ quickActions, initialMessage, emergencyMode, language, customGreeting, bgImage }) => {
  const t = UI_TRANSLATIONS[language];
  
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('unitec_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
        }
      }
    } catch (e) {
      console.error("Failed to load chat history", e);
    }
    return [
      {
        id: 'welcome',
        role: 'model',
        text: customGreeting || t.chatWelcome,
        timestamp: new Date()
      }
    ];
  });
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [showBookingConfirmation, setShowBookingConfirmation] = useState(false);
  const [confirmedDate, setConfirmedDate] = useState<string | null>(null);
  
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasProcessedInitial = useRef(false);

  // Memorize chats for training opportunities
  useEffect(() => {
    try {
      localStorage.setItem('unitec_chat_history', JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to save chat history", e);
    }
  }, [messages]);

  // Update welcome message when language or customGreeting changes, but only if it's the only message
  useEffect(() => {
    if (messages.length === 1 && messages[0].id === 'welcome') {
        setMessages([{
            id: 'welcome',
            role: 'model',
            text: customGreeting || t.chatWelcome,
            timestamp: new Date()
        }]);
    }
  }, [language, customGreeting, t.chatWelcome]);

  // Check for API Key on mount
  useEffect(() => {
    if (!process.env.GEMINI_API_KEY && !process.env.API_KEY) {
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
        const timer = setTimeout(() => setShowBookingConfirmation(false), 8000);
        return () => clearTimeout(timer);
    }
  }, [showBookingConfirmation]);

  useEffect(() => {
    if (showEmailConfirmation) {
        const timer = setTimeout(() => setShowEmailConfirmation(false), 8000);
        return () => clearTimeout(timer);
    }
  }, [showEmailConfirmation]);

  // Robust Auto-Scroll Implementation
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  };

  // Scroll on message updates or loading state changes
  useEffect(() => {
    // For streaming updates, 'auto' is usually better than 'smooth' to prevent jitter
    const behavior = isLoading ? 'auto' : 'smooth';
    scrollToBottom(behavior);
  }, [messages, isLoading]);

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
      // Prepare history for Gemini
      const history = messages.slice(1).map(m => ({
        role: m.role as 'user' | 'model',
        parts: [{ text: m.text }]
      }));

      const responseGenerator = sendMessageToGemini(
          text, 
          history,
          emergencyMode, 
          language,
          (toolName, result) => {
              if (toolName === 'book_appointment') {
                  setConfirmedDate(result.date || null);
                  setShowBookingConfirmation(true);
              } else if (toolName === 'send_email') {
                  setEmailSentTo(result.customerEmail || null);
                  setShowEmailConfirmation(true);
              } else if (toolName === 'email_conversation_to_admin') {
                  setEmailSentTo('Administrator');
                  setShowEmailConfirmation(true);
              }
          },
          customGreeting
      );
      
      const botMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: botMsgId,
        role: 'model',
        text: '', // Start empty for streaming
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
      case 'Truck': return <Truck size={16} />;
      case 'FileText': return <FileText size={16} />;
      case 'RefreshCcw': return <RefreshCcw size={16} />;
      case 'Percent': return <Percent size={16} />;
      default: return <Box size={16} />;
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      
      {/* Booking Confirmation Modal Overlay */}
      {showBookingConfirmation && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[40px] p-8 shadow-2xl border border-slate-100 max-w-xs w-full text-center animate-in zoom-in-95 duration-300">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-emerald-50">
                    <CheckCircle2 size={40} />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">{t.confirmed}</h3>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                    {t.bookingConfirmed}
                </p>
                {confirmedDate && (
                    <div className="bg-slate-50 rounded-2xl p-4 mb-8 border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.appointmentDetails}</p>
                        <p className="text-slate-900 font-bold text-sm">{confirmedDate}</p>
                    </div>
                )}
                <button 
                    onClick={() => setShowBookingConfirmation(false)}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
                >
                    {t.greatThanks}
                </button>
            </div>
        </div>
      )}

      {/* Email Confirmation Modal Overlay */}
      {showEmailConfirmation && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
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
      )}

      {/* Messages Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar relative scroll-smooth"
      >
        {/* Welcome Hero Image */}
        <div className="mb-8 rounded-3xl overflow-hidden shadow-lg border border-slate-100">
            <img 
                src={bgImage || "https://picsum.photos/seed/garden-decoration/800/400"} 
                alt="Welcome" 
                className="w-full h-40 object-cover"
                referrerPolicy="no-referrer"
            />
            <div className="p-4 bg-white">
                <p className="text-[10px] font-black text-brand-500 uppercase tracking-widest mb-1">{t.welcomeToSupport}</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                    {t.howCanWeAssist}
                </p>
            </div>
        </div>

        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                msg.role === 'user' ? 'bg-brand-500 text-white' : 'bg-brand-900 text-accent-500'
              }`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div 
                className={`p-4 rounded-2xl shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-brand-500 text-white rounded-br-none' 
                    : 'bg-white text-slate-800 rounded-bl-none border border-slate-100'
                }`}
              >
                 <Markdown
                   components={{
                     h1: ({node, ...props}: any) => <h1 className="text-xl font-black mt-4 mb-2 tracking-tight" {...props} />,
                     h2: ({node, ...props}: any) => <h2 className="text-lg font-bold mt-4 mb-2 tracking-tight" {...props} />,
                     h3: ({node, ...props}: any) => <h3 className="text-base font-bold mt-3 mb-2" {...props} />,
                     p: ({node, ...props}: any) => <p className="mt-2 first:mt-0 text-[15px] leading-relaxed" {...props} />,
                     ul: ({node, ...props}: any) => <ul className="list-disc pl-5 mt-2 space-y-1" {...props} />,
                     ol: ({node, ...props}: any) => <ol className="list-decimal pl-5 mt-2 space-y-1" {...props} />,
                     li: ({node, ...props}: any) => <li className="text-[15px] leading-relaxed" {...props} />,
                     strong: ({node, ...props}: any) => <strong className={`font-bold ${msg.role === 'user' ? 'text-white' : 'text-slate-900'}`} {...props} />,
                     a: ({node, ...props}: any) => <a className="text-brand-600 underline hover:text-brand-700" target="_blank" rel="noopener noreferrer" {...props} />,
                   }}
                 >
                   {msg.text}
                 </Markdown>
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
                <div className="bg-white p-3 rounded-2xl rounded-bl-none border border-gray-100 shadow-sm flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce"></div>
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                    {language === 'en' ? 'typing...' : 'escribiendo...'}
                  </span>
                </div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-4 w-full" />
      </div>

      {/* Input Area and Quick Actions remain the same... */}
      <div className="px-4 py-2 bg-white/50 backdrop-blur-sm border-t border-gray-50">
         <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 pt-1">
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
