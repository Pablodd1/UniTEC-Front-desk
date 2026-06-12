
import React, { useState, useRef, useEffect } from 'react';
import { Message, QuickAction, Language } from '../types';
import { saveChatSession } from '../services/firestoreService';
import { sendMessageToGemini } from '../services/geminiService';
import { createConversation, addMessage, requestIntervention, extractCustomerData, updateSessionStatus, subscribeToConversation, subscribeToMessages } from '../services/conversationService';
import { notifyStaffIntervention } from '../services/notificationService';
import { Send, Bot, User, Box, DollarSign, Hammer, BookOpen, CheckCircle2, Truck, FileText, RefreshCcw, Percent, Headphones, CreditCard, Lock } from 'lucide-react';
import { GenerateContentResponse } from '@google/genai';
import { UI_TRANSLATIONS } from '../constants';
import Markdown from 'react-markdown';
import { motion } from 'motion/react';

interface ChatTabProps {
  quickActions: QuickAction[];
  initialMessage?: string;
  emergencyMode?: boolean;
  language: Language;
  customGreeting?: string;
  bgImage?: string;
  brandId?: 'unitec' | 'building';
}

const ChatTab: React.FC<ChatTabProps> = ({ quickActions, initialMessage, emergencyMode, language, customGreeting, bgImage, brandId }) => {
  const t = UI_TRANSLATIONS[language];
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: customGreeting || t.chatWelcome,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');

  const [showPaymentSimulation, setShowPaymentSimulation] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentName, setPaymentName] = useState('');
  const [paymentEmail, setPaymentEmail] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [sessionStatus, setSessionStatus] = useState<'active' | 'human_requested' | 'human_assigned' | 'completed' | 'abandoned'>('active');
  const [showBookingConfirmation, setShowBookingConfirmation] = useState(false);
  const [confirmedDate, setConfirmedDate] = useState<string | null>(null);
  
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [extractedPii, setExtractedPii] = useState<{name?: string, phone?: string, email?: string} | null>(null);
  const [intentCategory, setIntentCategory] = useState<string | null>(null);
  
  // ===== NEW: Conversation Tracking =====
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showInterventionRequest, setShowInterventionRequest] = useState(false);
  const [interventionReason, setInterventionReason] = useState('');
  const [isRequestingIntervention, setIsRequestingIntervention] = useState(false);


  // Mark session completed on unmount
  useEffect(() => {
    return () => {
      if (conversationId) {
        updateSessionStatus(conversationId, 'completed').catch(() => {});
      }
    };
  }, [conversationId]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#payment-simulation')) {
        const params = new URLSearchParams(hash.substring(hash.indexOf('?')));
        setPaymentAmount(parseFloat(params.get('amount') || '0'));
        setPaymentName(decodeURIComponent(params.get('name') || ''));
        setPaymentEmail(decodeURIComponent(params.get('email') || ''));
        setShowPaymentSimulation(true);
        // Clear hash
        window.history.replaceState(null, '', ' ');
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasProcessedInitial = useRef(false);

  // ===== NEW: Initialize Conversation Session =====
  useEffect(() => {
    const initConversation = async () => {
      try {
        const id = await createConversation(
          brandId || 'unitec',
          language,
          'web',
          { userAgent: navigator.userAgent, ipAddress: 'unknown' }
        );
        setConversationId(id);
      } catch (e) {
        console.warn('Failed to create conversation session:', e);
      }
    };
    initConversation();
  }, [brandId, language]);

    // ===== NEW: Save messages to Conversation Tracking =====
  useEffect(() => {
    if (!conversationId || messages.length <= 1) return;
    
    const lastMessage = messages[messages.length - 1];
    
    // Throttle the streaming updates by only saving when isLoading is false, 
    // EXCEPT for user messages which we save immediately.
    if (isLoading && lastMessage.role === 'model') return;

    if (lastMessage.role === 'user') {
      addMessage(conversationId, {
        id: lastMessage.id,
        role: 'user',
        text: lastMessage.text,
      }).catch((e: any) => console.warn('Failed to save user message:', e));
    } else if (lastMessage.role === 'model' && lastMessage.text) {
      addMessage(conversationId, {
        id: lastMessage.id,
        role: 'model',
        text: lastMessage.text,
      }).catch((e: any) => console.warn('Failed to save model message:', e));
    }
  }, [messages, conversationId, isLoading]);
  // ===== Handle Session Status & Staff Intervention Messages =====
  useEffect(() => {
    if (!conversationId) return;
    
    const unsubStatus = subscribeToConversation(conversationId, (session) => {
      if (session && session.status) {
        setSessionStatus(session.status);
      }
    });

    const unsubMessages = subscribeToMessages(conversationId, (remoteMessages) => {
      if (!remoteMessages || remoteMessages.length === 0) return;
      
      const staffMsgs = remoteMessages.filter((m: any) => m.role === "staff" || m.isStaff);
      if (staffMsgs.length > 0) {
        setMessages(prev => {
          const existingTexts = new Set(prev.map(m => m.text));
          const newMsgs = staffMsgs
            .filter((m: any) => !existingTexts.has(m.text) && !existingTexts.has(`[Staff] ${m.text}`))
            .map((m: any) => ({
              id: m.id || Date.now().toString(),
              role: "model" as const,
              text: `[Staff] ${m.text}`,
              timestamp: new Date(m.timestamp)
            }));
          
          if (newMsgs.length > 0) {
            return [...prev, ...newMsgs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          }
          return prev;
        });
      }
    });

    return () => {
      unsubStatus();
      unsubMessages();
    };
  }, [conversationId]);
// Sync to Firebase (Only when AI is actively responding to avoid race-loops)
  useEffect(() => {
    if (messages.length > 1 && sessionStatus === 'active' && !isLoading && conversationId) {
      const sessionPayload: any = {
        id: conversationId,
        timestamp: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        messages: messages,
        customerName: extractedPii?.name || 'Anonymous Visitor',
        status: 'active',
      };
      if (extractedPii) {
        sessionPayload.extracted_pii = extractedPii;
      }
      if (intentCategory) {
        sessionPayload.intent_category = intentCategory;
      }
      saveChatSession(sessionPayload).catch(e => console.warn('Sync warning', e));
    }
  }, [messages, sessionStatus, isLoading]);

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

  // ===== NEW: 4-Minute Idle Timer =====
  useEffect(() => {
    if (sessionStatus !== 'active' || !conversationId || messages.length <= 1) return;

    const timeoutMs = 4 * 60 * 1000; // 4 minutes
    const timer = setTimeout(() => {
      console.log('Session idle for 4 minutes. Marking as abandoned.');
      updateSessionStatus(conversationId, 'abandoned').catch(() => {});
      
      setMessages(prev => [...prev, {
        id: `timeout_${Date.now()}`,
        role: 'model',
        text: language === 'en' ? 'Your chat session has timed out due to inactivity.' : 'Su sesión de chat ha expirado por inactividad.',
        timestamp: new Date()
      }]);
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [messages, sessionStatus, conversationId, language]);

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
              } else if (toolName === 'extract_customer_info') {
                  setExtractedPii(prev => {
                    const merged = { ...prev, ...result };
                    // Persist PII immediately to Firestore
                    if (conversationId) {
                      extractCustomerData(conversationId, merged).catch((e: any) =>
                        console.warn('Failed to save customer PII:', e)
                      );
                    }
                    return merged;
                  });
                  if (result.intent_category) setIntentCategory(result.intent_category);
              } else if (toolName === 'generate_checkout_payment_link') {
                  console.log("Stripe payment link generated successfully:", result.paymentLink);
                  if (result.paymentLink) {
                      window.location.href = result.paymentLink;
                  }
              }
          },
          customGreeting,
          brandId
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
      
      const isConfigError = error.message?.includes("API_KEY_MISSING") || (!process.env.GEMINI_API_KEY && !process.env.API_KEY);
      
      if (isConfigError) {
        setError(language === 'en' ? "Configuration Error: API Key is missing." : "Error de Configuración: Falta la API Key.");
      } else {
        const isLocalKeyUsed = typeof window !== 'undefined' && !!window.localStorage.getItem('unitec_gemini_api_key');
        const errorDetail = error.message || String(error);
        let errorText = language === 'en'
          ? `⚠️ Connection error (${errorDetail}). Please check your internet or API key and try again.`
          : `⚠️ Error de conexión (${errorDetail}). Por favor, revisa tu internet o la clave de API e inténtalo de nuevo.`;
        
        if (isLocalKeyUsed) {
          errorText += language === 'en'
            ? "\n\n*(Note: You have a local API key saved in this browser via the Admin Panel. If this key is invalid or expired, please clear or update it in Admin Settings.)*"
            : "\n\n*(Nota: Tienes una clave de API local guardada en este navegador a través del Panel de Administración. Si esta clave es inválida o expiró, por favor bórrala o actualízala en los ajustes del Administrador.)*";
        }

        // Show inline warning in chat history, but do not set global error to keep the input enabled for retry
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'model',
          text: errorText,
          timestamp: new Date()
        }]);
      }
      // Remove any empty pending bot messages if they exist
      setMessages(prev => prev.filter(m => m.text !== ''));
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

  // ===== NEW: Handle Request Human Intervention =====
  const handleRequestIntervention = async () => {
    if (!conversationId || !interventionReason.trim()) return;
    
    setIsRequestingIntervention(true);
    try {
      await requestIntervention(conversationId, interventionReason.trim(), 'high');
      await notifyStaffIntervention(conversationId, interventionReason.trim(), 'high');
      
      // Add system message to chat
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: language === 'en' 
          ? 'I have notified our team. A representative will join this conversation shortly.' 
          : 'He notificado a nuestro equipo. Un representante se unirá a esta conversación en breve.',
        timestamp: new Date()
      }]);
      
      setShowInterventionRequest(false);
      setInterventionReason('');
    } catch (e) {
      console.error('Failed to request intervention:', e);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: language === 'en'
          ? 'Unable to connect to staff. Please try again or call us directly.'
          : 'No se puede conectar con el personal. Por favor inténtalo de nuevo o llámanos directamente.',
        timestamp: new Date()
      }]);
    } finally {
      setIsRequestingIntervention(false);
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

      {/* Payment Simulation Modal Overlay */}
      {showPaymentSimulation && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] p-8 shadow-2xl border border-slate-100 max-w-sm w-full animate-in zoom-in-95 duration-300 text-left">
            {paymentSuccess ? (
              <div className="text-center py-6 animate-in fade-in duration-500">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-emerald-50">
                  <CheckCircle2 size={40} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">
                  {language === 'en' ? 'Payment Successful' : 'Pago Exitoso'}
                </h3>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                  {language === 'en' 
                    ? 'Thank you for your order! Your payment has been processed securely via Stripe.' 
                    : '¡Gracias por su compra! Su pago ha sido procesado de forma segura a través de Stripe.'}
                </p>
                <div className="bg-slate-50 rounded-2xl p-4 mb-8 border border-slate-100 text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{language === 'en' ? 'Amount Paid' : 'Monto Pagado'}</p>
                  <p className="text-emerald-600 font-extrabold text-xl">${paymentAmount.toFixed(2)} USD</p>
                  <p className="text-[10px] text-slate-400 mt-2">{language === 'en' ? 'Receipt sent to:' : 'Recibo enviado a:'} {paymentEmail}</p>
                </div>
                <button 
                  onClick={() => {
                    setShowPaymentSimulation(false);
                    setPaymentSuccess(false);
                    setMessages(prev => [...prev, {
                      id: Date.now().toString(),
                      role: 'user',
                      text: language === 'en' 
                        ? 'I have completed my payment. Thank you!' 
                        : 'Ya realicé mi pago. ¡Muchas gracias!',
                      timestamp: new Date()
                    }]);
                  }}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
                >
                  {language === 'en' ? 'Back to Chat' : 'Volver al Chat'}
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 tracking-tight text-lg">stripe</span>
                    <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">Test Mode</span>
                  </div>
                  <button 
                    onClick={() => setShowPaymentSimulation(false)}
                    className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                  >
                    {language === 'en' ? 'Cancel' : 'Cancelar'}
                  </button>
                </div>
                
                <div className="mb-6">
                  <p className="text-xs text-slate-400 mb-1">{language === 'en' ? 'Pay UNITEC USA DESIGN' : 'Pagar a UNITEC USA DESIGN'}</p>
                  <p className="text-3xl font-black text-slate-900 tracking-tight">${paymentAmount.toFixed(2)} <span className="text-sm font-bold text-slate-400">USD</span></p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{language === 'en' ? 'Email Address' : 'Correo Electrónico'}</label>
                    <input 
                      type="email" 
                      value={paymentEmail} 
                      onChange={(e) => setPaymentEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500" 
                      placeholder="email@example.com"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{language === 'en' ? 'Card Information' : 'Información de Tarjeta'}</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value="4242 4242 4242 4242" 
                        readOnly
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none text-slate-600 font-medium" 
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <CreditCard size={16} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <input 
                        type="text" 
                        value="12 / 29" 
                        readOnly
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-center text-slate-600" 
                      />
                      <input 
                        type="text" 
                        value="123" 
                        readOnly
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-center text-slate-600" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{language === 'en' ? 'Cardholder Name' : 'Nombre en Tarjeta'}</label>
                    <input 
                      type="text" 
                      value={paymentName} 
                      onChange={(e) => setPaymentName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500" 
                      placeholder="Jane Doe"
                    />
                  </div>

                  <button 
                    disabled={isPaying}
                    onClick={() => {
                      setIsPaying(true);
                      setTimeout(() => {
                        setIsPaying(false);
                        setPaymentSuccess(true);
                      }, 2000);
                    }}
                    className="w-full mt-6 py-4 bg-brand-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-700 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-brand-600/20"
                  >
                    <Lock size={12} />
                    {isPaying 
                      ? (language === 'en' ? 'Processing...' : 'Procesando...') 
                      : `${language === 'en' ? 'Pay' : 'Pagar'} $${paymentAmount.toFixed(2)}`}
                  </button>

                  <p className="text-[10px] text-slate-400 text-center mt-4">
                    🔒 {language === 'en' ? 'Secured by Stripe • Powered by Walio' : 'Seguridad por Stripe • Potenciado por Walio'}
                  </p>
                </div>
              </div>
            )}
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

        {messages
          .filter((msg, idx) => !(msg.role === 'model' && !msg.text && isLoading && idx === messages.length - 1))
          .map((msg, idx) => (
            <div 
              key={msg.id || `msg-${idx}`} 
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
        {isLoading && (messages[messages.length - 1]?.role === 'user' || (messages[messages.length - 1]?.role === 'model' && !messages[messages.length - 1]?.text)) && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
             <div className="flex max-w-[85%] items-end gap-2">
                <div className="w-8 h-8 rounded-full bg-brand-900 text-accent-500 flex items-center justify-center shrink-0 shadow-sm">
                  <Bot size={16} />
                </div>
                <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-none border border-slate-100 shadow-sm flex items-center gap-2">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ 
                          scale: [1, 1.2, 1],
                          opacity: [0.4, 1, 0.4]
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.2,
                          ease: "easeInOut"
                        }}
                        className="w-1.5 h-1.5 bg-brand-400 rounded-full"
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    {language === 'en' ? 'thinking' : 'pensando'}
                  </span>
                </div>
             </div>
          </motion.div>
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

      {/* NEW: Request Human Intervention Button */}
      {sessionStatus === 'active' && !showInterventionRequest && (
        <div className="px-4 pb-2 bg-white border-t border-gray-50">
          <button
            onClick={() => setShowInterventionRequest(true)}
            className="flex items-center gap-2 w-full justify-center py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-medium hover:bg-amber-100 transition-colors border border-amber-200"
          >
            <Headphones size={14} />
            Para ayuda aún más personalizada / Talk to a human
          </button>
        </div>
      )}

      {/* NEW: Intervention Request Modal */}
      {showInterventionRequest && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] p-8 shadow-2xl border border-slate-100 max-w-xs w-full text-center animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-amber-50">
              <Headphones size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">
              {language === 'en' ? 'Request Human' : 'Solicitar Humano'}
            </h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              {language === 'en' ? 'Our team will join this conversation shortly.' : 'Nuestro equipo se unirá a esta conversación en breve.'}
            </p>
            <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100">
              <textarea
                value={interventionReason}
                onChange={(e) => setInterventionReason(e.target.value)}
                placeholder={language === 'en' ? 'Briefly describe what you need...' : 'Describe brevemente lo que necesitas...'}
                className="w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-400 resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowInterventionRequest(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                {language === 'en' ? 'Cancel' : 'Cancelar'}
              </button>
              <button 
                onClick={handleRequestIntervention}
                disabled={isRequestingIntervention || !interventionReason.trim()}
                className="flex-1 py-3 bg-amber-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-amber-700 transition-all disabled:opacity-50"
              >
                {isRequestingIntervention ? 'Sending...' : language === 'en' ? 'Request' : 'Solicitar'}
              </button>
            </div>
          </div>
        </div>
      )}

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



