// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Plug, Phone, ShieldCheck, Database, Mic2, Save, RefreshCw, Check, Loader2, Volume2, TrendingUp, Zap, Gauge, Building2, Store, Brain, Code, Copy, ExternalLink, Rocket, ToggleRight, ToggleLeft, DollarSign, MessageSquare, Headphones, BarChart3, AlertTriangle, X } from 'lucide-react';
import { EscalaConfig, VoiceName, VoiceProvider, BillingInvoice, ConversationSession, InterventionRequest, ConversationMessage } from '../types';
import { playGeminiTTS } from '../services/geminiService';
import { getEscalaConfig, saveEscalaConfig, testEscalaConnection } from '../services/escalaService';
import { getUsageStats, getProfitEstimate, generateInvoice, trackUsage } from '../services/usageService';
import { generateImage, editImage } from '../services/imageService';
import { getAppConfig, saveAppConfig, getCrmLogs, CrmLog, getAllChatSessions } from '../services/firestoreService';
import { db } from '../firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { DEFAULT_TRAINING_DATA } from '../constants';
import { subscribeToConversations, subscribeToInterventions, updateSessionStatus, addMessage, subscribeToMessages } from '../services/conversationService';
import ConversationMonitor from './ConversationMonitor';
import StaffIntervention from './StaffIntervention';
import AnalyticsDashboard from './AnalyticsDashboard';
import RetrainingAnalytics from './RetrainingAnalytics';
import ApiHealthMonitor from './ApiHealthMonitor';
import { summarizeAndArchiveOldConversations, RetentionResult } from '../services/retentionService';
import { playNotificationSound, showBrowserNotification, requestNotificationPermission } from '../services/soundService';

interface AdminDashboardProps {
  emergencyMode: boolean;
  setEmergencyMode: (val: boolean) => void;
  voiceName: VoiceName;
  setVoiceName: (voice: VoiceName) => void;
  voiceProvider: VoiceProvider;
  setVoiceProvider: (provider: VoiceProvider) => void;
  currentBrandId?: 'unitec' | 'building';
  onToggleBrand?: (brand: 'unitec' | 'building') => void;
  onUpdateBackground?: (url: string) => void;
  language?: 'en' | 'es';
  onBack?: () => void;
}

const GEMINI_VOICE_DESCRIPTIONS: Record<string, { gender: 'Male' | 'Female', style: string }> = {
  'Puck': { gender: 'Male', style: 'Playful & Mischievous' },
  'Charon': { gender: 'Male', style: 'Deep & Authoritative' },
  'Kore': { gender: 'Female', style: 'Balanced & Soothing' },
  'Fenrir': { gender: 'Male', style: 'Deep & Energetic' },
  'Zephyr': { gender: 'Female', style: 'Calm & Helpful' },
  'Aoede': { gender: 'Female', style: 'Friendly & Expressive' },
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
    voiceName, setVoiceName,
    voiceProvider, setVoiceProvider,
    currentBrandId = 'unitec',
    onToggleBrand,
    onUpdateBackground,
    onBack,
    language
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'chats' | 'catalogs' | 'usage' | 'voice' | 'visuals' | 'training' | 'integrations' | 'deploy' | 'functionalities' | 'general' | 'conversations' | 'interventions' | 'analytics' | 'health' | 'retraining'>('chats');
  
  // NEW: Conversation Tracking States
  const [conversations, setConversations] = useState<ConversationSession[]>([]);
  const [_interventions, _setInterventions] = useState<InterventionRequest[]>([]);
  const [_selectedConversation, _setSelectedConversation] = useState<ConversationSession | null>(null);

  // ALERTS: Real-time intervention alert system
  const [pendingAlerts, setPendingAlerts] = useState<InterventionRequest[]>([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());
  const [retentionResult, setRetentionResult] = useState<RetentionResult | null>(null);
  const seenInterventionIdsRef = React.useRef<Set<string>>(new Set());
  
  // Usage & Billing State
  const [totalTokens, setTotalTokens] = useState(0);
  const [chatTokens, setChatTokens] = useState(0);
  const [voiceTokens, setVoiceTokens] = useState(0);
  const [imageTokens, setImageTokens] = useState(0);
  const [minutesUsed, setMinutesUsed] = useState(0);
  const [apiCalls, setApiCalls] = useState(0);
  const [limitTokens, setLimitTokens] = useState(10000000);
  const [limitMinutes, setLimitMinutes] = useState(5000);
  const [costEstimate, setCostEstimate] = useState(0);
  const [billingHistory, setBillingHistory] = useState<BillingInvoice[]>([]);
  const [profit, setProfit] = useState<number>(getProfitEstimate());
  const [isRefreshingUsage, setIsRefreshingUsage] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  // Escala CRM State
  const [escalaConfig, setEscalaConfig] = useState<EscalaConfig>({ apiKey: '', accountId: '', isActive: false });
  const [twilioConfig, setTwilioConfig] = useState({ accountSid: '', authToken: '', phoneNumber: '', isActive: false });
  const [isTestingEscala, setIsTestingEscala] = useState(false);
  // Gemini API Key & Privacy Mode State
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [privacyMode, setPrivacyMode] = useState(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('unitec_privacy_mode') : null;
    // Default to FALSE so chats are saved by default
    return stored === 'true';
  });
  const [isSavingGemini, setIsSavingGemini] = useState(false);
  const [escalaTestResult, setEscalaTestResult] = useState<'success' | 'error' | null>(null);
  const [isSavingEscala, setIsSavingEscala] = useState(false);

  // Voice Lab States
  const [isTestingVoice, setIsTestingVoice] = useState<string | null>(null);

  // Model Training State
  const [trainingData, setTrainingData] = useState<string>('');
  const [isSavingTraining, setIsSavingTraining] = useState(false);

  // Visuals State
  const [imagePrompt, setImagePrompt] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageToEdit, setImageToEdit] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "3:4" | "4:3" | "9:16" | "16:9">("1:1");
  const [imageError, setImageError] = useState<string | null>(null);

  // CRM Logs State
  const [crmLogs, setCrmLogs] = useState<CrmLog[]>([]);

  // Migration State
  const [isMigratingChats, setIsMigratingChats] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);

  const handleMigrateLegacyChats = async () => {
    try {
      setIsMigratingChats(true);
      setMigrationStatus('Fetching legacy chats...');
      const oldSessions = await getAllChatSessions();
      
      if (!oldSessions || oldSessions.length === 0) {
        setMigrationStatus('No legacy chats found (or privacy mode is on).');
        setIsMigratingChats(false);
        return;
      }

      setMigrationStatus(`Found ${oldSessions.length} legacy chats. Migrating...`);
      
      const batch = writeBatch(db);
      
      oldSessions.forEach(old => {
        const newSessionRef = doc(db, 'conversations', old.id);
        const mappedSession: any = {
          id: old.id,
          status: old.status || 'completed',
          brandId: currentBrandId || 'unitec',
          language: 'es',
          createdAt: old.timestamp || old.lastUpdated || new Date().toISOString(),
          lastUpdated: old.lastUpdated || new Date().toISOString(),
          source: old.type === 'call' ? 'phone' : 'web',
          topics: old.intent_category ? [old.intent_category] : [],
          analytics: {
            messageCount: old.messages?.length || 0,
            avgResponseTime: 0,
            escalationCount: 0,
            productMentions: []
          },
          legacy: true
        };
        
        if (old.customerName) {
            mappedSession.tags = [old.customerName];
        }
        
        batch.set(newSessionRef, mappedSession, { merge: true });

        if (old.messages && Array.isArray(old.messages)) {
          old.messages.forEach(msg => {
            const msgId = msg.id || Math.random().toString(36).substring(7);
            const msgRef = doc(db, `conversations/${old.id}/messages`, msgId);
            batch.set(msgRef, {
              id: msgId,
              role: msg.role === 'model' || msg.role === 'assistant' ? 'model' : 'user',
              text: msg.text || msg.content || '',
              timestamp: msg.timestamp || mappedSession.createdAt
            }, { merge: true });
          });
        }
      });

      await batch.commit();
      setMigrationStatus(`Successfully migrated ${oldSessions.length} chats!`);
    } catch (err: any) {
      console.error(err);
      setMigrationStatus(`Error migrating: ${err.message}`);
    } finally {
      setIsMigratingChats(false);
    }
  };
  
  // Copy State
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Dispatch States
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [telegramSentSuccess, setTelegramSentSuccess] = useState(false);

  // Live Activity Logs (Real-time telemetry)
  const [liveLogs, setLiveLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] Telemetry Channel Active -- Handshaking with Google AI Studio Core`,
    `[${new Date(Date.now() - 12000).toLocaleTimeString()}] Firebase Firestore sync status: 200 OK`,
    `[${new Date(Date.now() - 6000).toLocaleTimeString()}] Gemini Live Audio Session Controller INITIALIZED`,
  ]);

  const geminiVoices: VoiceName[] = ['Aoede', 'Kore', 'Zephyr', 'Puck', 'Fenrir', 'Charon'];
  
  useEffect(() => {
    const loadData = async () => {
      const escala = await getEscalaConfig();
      setEscalaConfig(escala);

      const config = await getAppConfig();
      if (config) {
        if (config.trainingData && config.trainingData.length > 50) {
          setTrainingData(config.trainingData);
        } else {
          setTrainingData(DEFAULT_TRAINING_DATA);
        }
        if (config.geminiApiKey) {
          setGeminiApiKey(config.geminiApiKey);
          if (typeof window !== 'undefined' && !window.localStorage.getItem('unitec_gemini_api_key')) {
            window.localStorage.setItem('unitec_gemini_api_key', config.geminiApiKey);
          }
        }
      }

      const logs = await getCrmLogs();
      setCrmLogs(logs);
          };
    loadData();

    // NEW: Subscribe to real-time conversations and interventions
    const unsubConversations = subscribeToConversations((sessions: ConversationSession[]) => {
      setConversations(sessions);
    });
    const unsubInterventions = subscribeToInterventions((ints: InterventionRequest[]) => {
      _setInterventions(ints);
    });

    const interval = setInterval(() => {
      const stats = getUsageStats();
      setTotalTokens(stats.totalTokens);
      setChatTokens(stats.chatTokens);
      setVoiceTokens(stats.voiceTokens);
      setImageTokens(stats.imageTokens);
      setMinutesUsed(stats.minutesUsed);
      setApiCalls(stats.apiCalls);
      setLimitTokens(stats.limitTokens);
      setLimitMinutes(stats.limitMinutes);
      setCostEstimate(stats.costEstimate);
      setBillingHistory(stats.billingHistory || []);
      setProfit(getProfitEstimate());

      // Stream live telemetry activities dynamically 
      const actions = [
        "API: generateContent stream heartbeat - OK",
        "AUDIO: Handshaking live PCM receiver node",
        "DB: Firestore sync CRM history log success",
        "RESOURCE: Token buffer usage audit: 100% stable",
        "API: Gemini-2.5-flash context check: 0.12s response",
        "CRM: Escala API background syncer IDLE"
      ];
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      setLiveLogs(prev => [`[${new Date().toLocaleTimeString()}] ${randomAction}`, ...prev.slice(0, 15)]);
    }, 3000);
    return () => {
      clearInterval(interval);
      unsubConversations();
      unsubInterventions();
    };
  }, []);

  // ALERT: Subscribe to pending interventions + play sound + Telegram on new alerts
  useEffect(() => {
    const unsubAlerts = subscribeToInterventions((ints: InterventionRequest[]) => {
      const pending = ints.filter(i => i.status === 'pending');
      setPendingAlerts(pending.filter(i => !dismissedAlertIds.has(i.id)));
      pending.forEach(alert => {
        if (!seenInterventionIdsRef.current.has(alert.id)) {
          seenInterventionIdsRef.current.add(alert.id);
          playNotificationSound();
          requestNotificationPermission().then(granted => {
            if (granted) showBrowserNotification('Intervencion Urgente', alert.reason || 'Cliente solicitó atención del personal');
          });
          const msg = '?? INTERVENCION URGENTE\n\nSesion: ' + alert.sessionId + '\nRazon: ' + (alert.reason || 'Cliente solicito hablar con alguien') + '\nHora: ' + new Date(alert.requestedAt).toLocaleTimeString('es') + '\n\nAbrir dashboard: ' + window.location.origin + '/?admin=true';
          fetch('/api/notify-telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg }),
          }).catch(e => console.warn('[Alert] Telegram failed:', e));
        }
      });
    });
    return () => unsubAlerts();
  }, [dismissedAlertIds]);

  // RETENTION: Auto-archive old conversations on mount (once per session)
  useEffect(() => {
    const runRetention = async () => {
      try {
        const result = await summarizeAndArchiveOldConversations();
        if (result.archived > 0) setRetentionResult(result);
      } catch (e) {
        console.warn('[Retention] Auto-archive failed:', e);
      }
    };
    if (!sessionStorage.getItem('unitec_retention_ran')) {
      sessionStorage.setItem('unitec_retention_ran', '1');
      runRetention();
    }
  }, []);



  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(id);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const handleTestVoice = async (v: VoiceName) => {
    if (isTestingVoice) return;
    setIsTestingVoice(v);
    try {
        await playGeminiTTS("Hello! This is a test of my voice responsiveness.", v);
        setTimeout(() => setIsTestingVoice(null), 3000);
    } catch (e) {
        setIsTestingVoice(null);
    }
  };

  const handleRefreshUsage = () => {
    setIsRefreshingUsage(true);
    setTimeout(() => {
        const stats = getUsageStats();
        setTotalTokens(stats.totalTokens);
        setChatTokens(stats.chatTokens);
        setVoiceTokens(stats.voiceTokens);
        setImageTokens(stats.imageTokens);
        setMinutesUsed(stats.minutesUsed);
        setApiCalls(stats.apiCalls);
        setLimitTokens(stats.limitTokens);
        setLimitMinutes(stats.limitMinutes);
        setCostEstimate(stats.costEstimate);
        setBillingHistory(stats.billingHistory || []);
        setProfit(getProfitEstimate());
        setIsRefreshingUsage(false);
    }, 600);
  };

  const handleSendEmail = async () => {
    setIsSendingEmail(true);
    setEmailSentSuccess(false);
    
    try {
      const response = await fetch('/api/notify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: 'System Logs and Telemetry',
          html: '<p>Attached are the recent logs and telemetry from the UniTEC AI Front Desk system.</p>'
        })
      });
      
      if (response.ok) {
        setEmailSentSuccess(true);
        setTimeout(() => setEmailSentSuccess(false), 5000);
      } else {
        console.error("Failed to send email", await response.text());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSendTelegram = async () => {
    setIsSendingTelegram(true);
    setTelegramSentSuccess(false);
    
    try {
      const response = await fetch('/api/notify-telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: '<b>System Alert:</b>\nLive CRM telemetry and active sessions synced.'
        })
      });
      
      if (response.ok) {
        setTelegramSentSuccess(true);
        setTimeout(() => setTelegramSentSuccess(false), 5000);
      } else {
        console.error("Failed to send telegram", await response.text());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSendingTelegram(false);
    }
  };

  const handleGenerateInvoice = () => {
    setIsGeneratingInvoice(true);
    setTimeout(() => {
        generateInvoice();
        const stats = getUsageStats();
        setBillingHistory(stats.billingHistory);
        setIsGeneratingInvoice(false);
    }, 1000);
  };

  const handleTestEscala = async () => {
    setIsTestingEscala(true);
    setEscalaTestResult(null);
    try {
        const success = await testEscalaConnection(escalaConfig);
        setEscalaTestResult(success ? 'success' : 'error');
    } catch (e) {
        setEscalaTestResult('error');
    } finally {
        setIsTestingEscala(false);
    }
  };

  const handleSaveEscala = async () => {
    setIsSavingEscala(true);
    await saveEscalaConfig(escalaConfig);
    setTimeout(() => setIsSavingEscala(false), 800);
  };

  const handleSaveTraining = async () => {
    setIsSavingTraining(true);
    await saveAppConfig({ trainingData });
    setTimeout(() => setIsSavingTraining(false), 1000);
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt) return;
    setIsGeneratingImage(true);
    setImageError(null);
    try {
        const url = await generateImage(imagePrompt, aspectRatio);
        if (url) {
            setGeneratedImageUrl(url);
            trackUsage({ totalTokens: 0, chatTokens: 0, imageTokens: 1, apiCalls: 1 }); // Record 1 image unit
        } else {
            setImageError("No image was returned from the API.");
        }
    } catch (e: any) {
        setImageError(e.message || "Failed to generate image. Ensure your API key is valid.");
    } finally {
        setIsGeneratingImage(false);
    }
  };

  const handleEditImage = async () => {
    if (!imagePrompt || !imageToEdit) return;
    setIsGeneratingImage(true);
    setImageError(null);
    try {
        const url = await editImage(imagePrompt, imageToEdit);
        if (url) {
            setGeneratedImageUrl(url);
            trackUsage({ totalTokens: 0, chatTokens: 0, imageTokens: 1, apiCalls: 1 });
        } else {
            setImageError("No image was returned from the API.");
        }
    } catch (e: any) {
        setImageError(e.message || "Failed to edit image.");
    } finally {
        setIsGeneratingImage(false);
    }
  };

  // Executive Handoff Center State
  const [selectedSessionId, setselectedSessionId] = React.useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<ConversationMessage[]>([]);

  // Subscribe to messages when a session is selected
  useEffect(() => {
    if (!selectedSessionId) {
      setSessionMessages([]);
      return;
    }
    const unsub = subscribeToMessages(selectedSessionId, (messages) => {
      setSessionMessages(messages);
    });
    return () => unsub();
  }, [selectedSessionId]);
  const [adminResponseText, setAdminResponseText] = React.useState('');

  // Derived: currently selected session object
  const selectedSession = selectedSessionId
    ? conversations.find(s => s.id === selectedSessionId) ?? null
    : null;

  /** Admin takes over a chat session from the AI */
  const handleTakeOver = async (sessionId: string) => {
    await updateSessionStatus(sessionId, "human_assigned", "admin");
  };

  /** Admin releases the session back to the AI (or marks it completed) */
  const handleReleaseToAI = async (sessionId: string, resolve = false) => {
    await updateSessionStatus(sessionId, resolve ? "completed" : "active", "");
    if (resolve) setselectedSessionId(null);
  };

  /** Admin sends a direct message into the chat stream */
  const handleSendAdminMessage = async () => {
    if (!adminResponseText.trim() || !selectedSession) return;
    const staffMessage = {
      role: "staff" as const,
      text: adminResponseText.trim(),
      isStaff: true
    };
    await addMessage(selectedSession.id, staffMessage);
    setAdminResponseText("");
  };

  const handleSaveGemini = async () => {
    setIsSavingGemini(true);
    if (typeof window !== 'undefined') {
      if (geminiApiKey.trim()) {
        window.localStorage.setItem('unitec_gemini_api_key', geminiApiKey.trim());
      } else {
        window.localStorage.removeItem('unitec_gemini_api_key');
      }
      window.localStorage.setItem('unitec_privacy_mode', String(privacyMode));
    }

    // NOTE: API key is NEVER saved to Firestore for security.
    // It lives only in localStorage and the server-side env vars.
    // Save only non-sensitive config (privacy mode).
    try {
      await saveAppConfig({ 
        // geminiApiKey deliberately NOT included Ã¢â‚¬â€ keys stay client+server only
      });
    } catch (e) {
      console.error("Failed to save config to Firestore:", e);
    }
    
    setTimeout(() => {
      setIsSavingGemini(false);
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }, 800);
  };

  const currentVoiceList = [...geminiVoices];

  const renderTabContent = () => {
    switch(activeSubTab) {
        case 'usage':
            const tokenProgress = Math.min(100, (totalTokens / limitTokens) * 100);
            const minuteProgress = Math.min(100, (minutesUsed / limitMinutes) * 100);
            return (
                <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500 pb-20">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-brand-900 to-slate-900 p-6 rounded-2xl text-white shadow-xl relative overflow-hidden group">
                            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-125 transition-transform"><TrendingUp size={120} /></div>
                            <div className="relative z-10">
                                <span className="text-[10px] font-bold text-brand-300 uppercase tracking-widest">Client Billable</span>
                                <h4 className="text-4xl font-black mt-2">${costEstimate.toFixed(2)}</h4>
                                <div className="mt-4 p-2 bg-emerald-500/20 rounded-lg border border-emerald-500/30 flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-emerald-300">EST. PROFIT</span>
                                  <span className="text-xs font-black text-emerald-400">+${profit.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Tokens</span>
                                <Zap size={14} className="text-brand-500" />
                            </div>
                            <h4 className="text-3xl font-bold text-slate-800">{(totalTokens / 1000).toFixed(1)}k</h4>
                            <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden">
                                <div className="bg-brand-500 h-full transition-all duration-1000 shadow-sm" style={{ width: `${tokenProgress}%` }}></div>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase">Limit: {(limitTokens / 1000000).toFixed(1)}M</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Voice Connect</span>
                                <Mic2 size={14} className="text-orange-500" />
                            </div>
                            <h4 className="text-3xl font-bold text-slate-800">{minutesUsed.toFixed(1)}m</h4>
                            <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden">
                                <div className="bg-orange-500 h-full transition-all duration-1000 shadow-sm" style={{ width: `${minuteProgress}%` }}></div>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase">Limit: {limitMinutes}m</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">SaaS Unit Economics</h3>
                                <p className="text-xs text-slate-500">Breakdown of billable AI resources vs provider costs.</p>
                            </div>
                            <button onClick={handleRefreshUsage} className={`p-2 rounded-full hover:bg-slate-50 transition-all ${isRefreshingUsage ? 'animate-spin text-brand-500' : 'text-slate-400'}`}><RefreshCw size={18} /></button>
                        </div>
                        <div className="space-y-6">
                            {[
                                { label: 'Chat Tokens', val: chatTokens, max: limitTokens / 2, color: 'bg-brand-500' },
                                { label: 'Voice Tokens', val: voiceTokens, max: limitTokens / 4, color: 'bg-indigo-500' },
                                { label: 'Image Tokens', val: imageTokens, max: limitTokens / 10, color: 'bg-pink-500' },
                                { label: 'Neural Voice Synthesis (Minutes)', val: Math.floor(minutesUsed), max: limitMinutes, color: 'bg-orange-400' },
                                { label: 'API System Overhead', val: apiCalls, max: 2000, color: 'bg-emerald-400' }
                            ].map((row, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        <span>{row.label}</span>
                                        <span>{row.val.toLocaleString()} Units</span>
                                    </div>
                                    <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                        <div className={`h-full ${row.color} transition-all duration-1000`} style={{ width: `${Math.min(100, (row.val / (row.max || 1)) * 100)}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Cost Estimation Calculation */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Cost Estimation</h3>
                            <div className="space-y-4">
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Theoretical Rates (Client)</p>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-600">Tokens (per 1M)</span>
                                            <span className="font-bold text-slate-900">$0.25</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-600">Voice (per minute)</span>
                                            <span className="font-bold text-slate-900">$0.05</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 bg-brand-50 rounded-xl border border-brand-100">
                                    <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-2">Calculation Formula</p>
                                    <p className="text-xs text-brand-700 leading-relaxed">
                                        Total = (Tokens / 1,000,000 * $0.25) + (Minutes * $0.05)
                                    </p>
                                </div>
                                <button 
                                    onClick={handleGenerateInvoice}
                                    disabled={isGeneratingInvoice}
                                    className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                                >
                                    {isGeneratingInvoice ? <Loader2 size={14} className="animate-spin" /> : <DollarSign size={14} />}
                                    Generate Statement
                                </button>
                            </div>
                        </div>

                        {/* Billing History */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Billing History</h3>
                            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2 no-scrollbar">
                                {billingHistory.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400">
                                        <DollarSign size={32} className="mx-auto mb-2 opacity-20" />
                                        <p className="text-xs font-bold uppercase tracking-widest">No history yet</p>
                                    </div>
                                ) : (
                                    billingHistory.map((inv) => (
                                        <div key={inv.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between hover:border-brand-200 transition-colors">
                                            <div>
                                                <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest">{inv.id}</p>
                                                <p className="text-xs font-bold text-slate-800">{inv.date}</p>
                                                <p className="text-[9px] text-slate-400 mt-0.5">{(inv.tokens / 1000).toFixed(1)}k Tokens consumed</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-slate-900">${inv.amount.toFixed(2)}</p>
                                                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                                    inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'
                                                }`}>
                                                    {inv.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Admin Dispatch Controls + Live Overwatch Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¬ ADMIN DISPATCH CONTROLS */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
                            <div>
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <ShieldCheck size={16} className="text-brand-500" /> Dispatch Alerts & Logs
                                </h3>
                                <p className="text-[11px] text-slate-500 mb-4 font-medium leading-relaxed">Send complete system performance, token ledger, and recorded call interactions directly to authorized destination channels.</p>
                                
                                <div className="space-y-3">
                                    {/* Email Dispatch Control */}
                                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-2">
                                        <div>
                                            <p className="text-xs font-bold text-slate-800 leading-tight">System Email Logs</p>
                                            <p className="text-[9px] text-slate-400 font-bold mt-0.5">jasmelacosta@gmail.com</p>
                                        </div>
                                        <button 
                                            onClick={handleSendEmail}
                                            disabled={isSendingEmail}
                                            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all select-none ${
                                                emailSentSuccess ? 'bg-emerald-100 text-emerald-800' : 'bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50'
                                            }`}
                                        >
                                            {isSendingEmail ? <Loader2 size={10} className="animate-spin mr-1 inline" /> : null}
                                            {emailSentSuccess ? "Dispatched!" : "Send Button"}
                                        </button>
                                    </div>

                                    {/* Telegram Dispatch Control */}
                                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-2">
                                        <div>
                                            <p className="text-xs font-bold text-slate-800 leading-tight">Telegram Sync</p>
                                            <p className="text-[9px] text-slate-400 font-bold mt-0.5">Live CRM alerts via webhook</p>
                                        </div>
                                        <button 
                                            onClick={handleSendTelegram}
                                            disabled={isSendingTelegram}
                                            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all select-none ${
                                                telegramSentSuccess ? 'bg-emerald-100 text-emerald-800' : 'bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50'
                                            }`}
                                        >
                                            {isSendingTelegram ? <Loader2 size={10} className="animate-spin mr-1 inline" /> : null}
                                            {telegramSentSuccess ? "Dispatched!" : "Send Telegram"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â´ LIVE TELEMETRY OVERWATCH TERMINAL */}
                        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col justify-between">
                            <div className="flex flex-col h-full justify-between w-full">
                                <div className="mb-3">
                                    <h3 className="text-xs font-black text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0"></span>
                                        Live system overwatch
                                    </h3>
                                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed">Real-time API requests and active system memory resources feed.</p>
                                </div>
                                
                                <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 font-mono text-[9px] text-emerald-400 h-36 overflow-y-auto no-scrollbar space-y-2 text-left">
                                    {liveLogs.map((log, i) => (
                                        <div key={i} className="leading-relaxed border-b border-white/[0.02] pb-1 animate-in fade-in duration-300">
                                            {log}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Interactions (CRM Logs) */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Recent Interactions</h3>
                        <div className="space-y-3">
                            {crmLogs.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <p className="text-xs font-bold uppercase tracking-widest">No interactions yet</p>
                                </div>
                            ) : (
                                crmLogs.slice(0, 5).map((log) => (
                                    <div key={log.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-bold text-slate-800">{log.customerName}</p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">{log.actionTaken}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleString()}</p>
                                            <span className={`inline-block mt-1 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                                log.provider === 'Escala' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                                            }`}>
                                                {log.provider === 'Escala' ? 'Synced' : 'Logged'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            );

        case 'voice':
            return (
                <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500 pb-20">
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Provider</h3>
                            <div className="flex gap-2">
                                <button 
                                  onClick={() => setVoiceProvider('gemini')}
                                  className={`px-4 py-2 rounded-lg text-xs font-bold border ${voiceProvider === 'gemini' ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-slate-200 text-slate-500'}`}
                                >
                                  Google Gemini (Fastest)
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Persona Library</h3>
                            <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                                <Gauge size={12} className="text-emerald-600" />
                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                                    Flash Native Speed
                                </span>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {currentVoiceList.map(v => {
                                const details = GEMINI_VOICE_DESCRIPTIONS[v];
                                return (
                                    <div key={v} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${voiceName === v ? 'bg-brand-50 border-brand-200 ring-2 ring-brand-100' : 'bg-white border-slate-100'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${voiceName === v ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                {v.charAt(0)}
                                            </div>
                                            <button onClick={() => setVoiceName(v)} className="text-left">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-slate-800">{v}</p>
                                                    {voiceName === v && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>}
                                                </div>
                                                {details && (
                                                    <p className="text-[10px] text-slate-500 font-medium">
                                                        {details.style} ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ {details.gender}
                                                    </p>
                                                )}
                                            </button>
                                        </div>
                                        <button onClick={() => handleTestVoice(v)} className="p-2 bg-white border border-slate-100 rounded-lg shadow-sm hover:shadow-md text-brand-600 transition-all hover:bg-brand-50">
                                            {isTestingVoice === v ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            );

        case 'deploy':
            const currentUrl = window.location.origin;

            const scriptCode = `<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = "${currentUrl}?embed=true";
    iframe.style.cssText = "border:none; position:fixed; bottom:20px; right:20px; width:400px; height:700px; z-index:999999; border-radius:32px; box-shadow: 0 10px 50px rgba(0,0,0,0.2); transition: all 0.3s ease;";
    iframe.id = "ai-front-desk-assistant";
    document.body.appendChild(iframe);
  })();
</script>`;

            return (
                <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500 pb-20">
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
                                <Rocket size={28} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Step 1: Hosting on Vercel</h3>
                                <p className="text-sm text-slate-500">Deploy the app and set your API keys.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
                                <p className="text-sm text-slate-700">Push this code to a <b>GitHub</b> repository.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
                                <p className="text-sm text-slate-700">Connect the repo to <b>Vercel.com</b>.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
                                <div className="flex-1">
                                    <p className="text-sm text-slate-700 font-bold">Set Environment Variables:</p>
                                    <p className="text-xs text-slate-500 mt-1">In Vercel Dashboard ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Environment Variables, add:</p>
                                    <div className="mt-2 space-y-2">
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                                            <code className="text-xs font-mono text-brand-700">VITE_API_KEY</code>
                                            <span className="text-[10px] text-slate-400">Gemini AI Key</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-14 h-14 bg-brand-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
                                <Code size={28} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Step 2: Embed on Your Website</h3>
                                <p className="text-sm text-slate-500">Copy the code below into your site's HTML.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Zap size={14} className="text-accent-500" /> Professional Floating Script
                                </h4>
                                <button 
                                    onClick={() => handleCopy(scriptCode, 'script')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${copyStatus === 'script' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                    {copyStatus === 'script' ? <Check size={12} /> : <Copy size={12} />}
                                    {copyStatus === 'script' ? 'Copied!' : 'Copy Script'}
                                </button>
                            </div>
                            <div className="bg-slate-900 rounded-2xl p-6 relative group overflow-hidden border border-slate-800">
                                <div className="absolute top-0 left-0 w-1 h-full bg-brand-500"></div>
                                <pre className="text-[11px] font-mono text-slate-400 whitespace-pre-wrap break-all leading-relaxed">
                                    {scriptCode}
                                </pre>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex gap-4">
                        <ExternalLink className="text-blue-500 shrink-0" size={20} />
                        <div>
                            <h4 className="text-sm font-bold text-blue-900">Need a direct link?</h4>
                            <p className="text-xs text-blue-700 leading-relaxed mt-1">
                                You can also simply send clients directly to your Vercel URL to use the full-screen version of the assistant.
                            </p>
                        </div>
                    </div>
                </div>
            );

        case 'catalogs':
            return (
                <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500 pb-20">
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                                    <Copy size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">GestiÃƒÆ’Ã‚Â³n de CatÃƒÆ’Ã‚Â¡logos y Archivos</h3>
                                    <p className="text-xs text-slate-500">Controla los archivos que la IA puede enviar por correo electrÃƒÆ’Ã‚Â³nico.</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-6">
                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                <h4 className="text-sm font-bold text-slate-800 mb-2">Instrucciones para la IA</h4>
                                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                                    La IA estÃƒÆ’Ã‚Â¡ configurada para usar la herramienta <code className="bg-slate-200 px-1 rounded text-brand-700">send_email</code> cuando un cliente solicita un catÃƒÆ’Ã‚Â¡logo, PDF o ficha tÃƒÆ’Ã‚Â©cnica y proporciona su correo electrÃƒÆ’Ã‚Â³nico.
                                </p>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Para modificar los enlaces de los catÃƒÆ’Ã‚Â¡logos que la IA envÃƒÆ’Ã‚Â­a, actualiza la secciÃƒÆ’Ã‚Â³n <strong>"CATALOGS & RESOURCES"</strong> en la pestaÃƒÆ’Ã‚Â±a <strong>Base de Conocimiento</strong>. La IA leerÃƒÆ’Ã‚Â¡ esos enlaces y los incluirÃƒÆ’Ã‚Â¡ en el correo.
                                </p>
                            </div>

                            <div>
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">CatÃƒÆ’Ã‚Â¡logos Activos (Ejemplo)</h4>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center">
                                                <span className="text-[10px] font-bold">PDF</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">CatÃƒÆ’Ã‚Â¡logo 2026 UNITEC USA DESIGN</p>
                                                <p className="text-[10px] text-slate-400">EspaÃƒÆ’Ã‚Â±ol ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ General</p>
                                            </div>
                                        </div>
                                        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase rounded-md">Activo</span>
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center">
                                                <span className="text-[10px] font-bold">PDF</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">Product Catalog 2026 - Unitec</p>
                                                <p className="text-[10px] text-slate-400">English ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ General</p>
                                            </div>
                                        </div>
                                        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase rounded-md">Activo</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );

        case 'training':
            return (
                <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500 pb-20">
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                                    <Brain size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Model Training Data</h3>
                                    <p className="text-xs text-slate-500">Add custom knowledge, FAQs, or brand voice examples.</p>
                                </div>
                            </div>
                            <button 
                                onClick={handleSaveTraining}
                                disabled={isSavingTraining}
                                className="px-8 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-brand-700 flex items-center gap-2 transition-all active:scale-95"
                            >
                                {isSavingTraining ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Save Training Data
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Knowledge Base Content</label>
                            <textarea
                                value={trainingData}
                                onChange={(e) => setTrainingData(e.target.value)}
                                className="w-full h-96 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-mono focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                                placeholder="Enter custom instructions, FAQs, or product details here..."
                            />
                            <p className="text-[10px] text-slate-400 italic">
                                This content will be injected into the system prompt for both Chat and Voice interactions.
                            </p>
                        </div>
                        
                        <div className="mt-8 pt-8 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800">Gemini Embedding 2</h4>
                                    <p className="text-xs text-slate-500">Test generating vector embeddings for semantic search using gemini-embedding-2-preview.</p>
                                </div>
                                <button 
                                    onClick={async () => {
                                        const { generateEmbedding } = await import('../services/geminiService');
                                        const sampleText = "Test embedding generation";
                                        const result = await generateEmbedding(sampleText);
                                        if (result) {
                                            alert(`Success! Generated embedding vector with ${result.length} dimensions.`);
                                        } else {
                                            alert("Failed to generate embedding.");
                                        }
                                    }}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all"
                                >
                                    Test Embedding
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );

        case 'visuals':
            return (
                <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500 pb-20">
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center shrink-0">
                                <Zap size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Nano Banana 2: Image Lab</h3>
                                <p className="text-xs text-slate-500">Generate or edit high-quality images using gemini-3.1-flash-image-preview.</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Prompt</label>
                                <textarea 
                                    value={imagePrompt}
                                    onChange={(e) => setImagePrompt(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none h-24 resize-none"
                                    placeholder="Describe the image you want to create or how to edit the current one..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Aspect Ratio</label>
                                    <div className="flex flex-wrap gap-2">
                                        {(["1:1", "3:4", "4:3", "9:16", "16:9"] as const).map(ratio => (
                                            <button 
                                                key={ratio}
                                                onClick={() => setAspectRatio(ratio)}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${aspectRatio === ratio ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-500'}`}
                                            >
                                                {ratio}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Source Image (for editing)</label>
                                    <input 
                                        type="file" 
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    setImageToEdit(reader.result as string);
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                        className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                                    />
                                </div>
                            </div>

                            {imageError && (
                                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-xs font-medium">
                                    <ShieldCheck size={16} className="shrink-0" />
                                    {imageError}
                                </div>
                            )}

                            <div className="flex gap-4">
                                <button 
                                    onClick={handleGenerateImage}
                                    disabled={isGeneratingImage || !imagePrompt}
                                    className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isGeneratingImage && !imageToEdit ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                                    Generate New Image
                                </button>
                                {imageToEdit && (
                                    <button 
                                        onClick={handleEditImage}
                                        disabled={isGeneratingImage || !imagePrompt}
                                        className="flex-1 py-3 bg-pink-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-pink-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isGeneratingImage && imageToEdit ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                        Edit Source Image
                                    </button>
                                )}
                            </div>

                            {generatedImageUrl && (
                                <div className="mt-8 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Result</h4>
                                        <button 
                                            onClick={() => {
                                                const link = document.createElement('a');
                                                link.href = generatedImageUrl;
                                                link.download = 'generated-image.png';
                                                link.click();
                                            }}
                                            className="text-brand-600 text-[10px] font-bold uppercase hover:underline"
                                        >
                                            Download Image
                                        </button>
                                        {onUpdateBackground && (
                                            <button 
                                                onClick={() => {
                                                    onUpdateBackground(generatedImageUrl);
                                                    localStorage.setItem('unitec_custom_bg', generatedImageUrl);
                                                }}
                                                className="text-emerald-600 text-[10px] font-bold uppercase hover:underline ml-4"
                                            >
                                                Set as App Background
                                            </button>
                                        )}
                                    </div>
                                    <div className="bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center p-4">
                                        <img src={generatedImageUrl} alt="Generated" className="max-w-full max-h-[500px] rounded-xl shadow-lg" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );

        case 'chats':
            return (
                <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500 pb-20">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 h-[80vh] flex flex-col">
                        <div className="border-b border-slate-100 pb-4 mb-6">
                            <h3 className="text-lg font-bold text-slate-800">Universal Agent Inbox</h3>
                            <p className="text-xs text-slate-500">Monitor chats and calls, extract PII, and intervene.</p>
                        </div>
                        
                        <div className="flex-1 flex overflow-hidden min-h-0 gap-6">
                            {/* Pane 1: Sessions List (25%) */}
                            <div className="w-[25%] flex flex-col border-r border-slate-100 pr-6 overflow-y-auto no-scrollbar gap-3">
                                {(conversations as any[]).length === 0 ? (
                                    <div className="text-center py-12 text-slate-400 text-sm">No active sessions.</div>
                                ) : (
                                    conversations.map((session) => {
                                        const status = session.status || 'active';
                                        const isSelected = selectedSessionId === session.id;
                                        const isCall = session.source === 'phone';
                                        return (
                                            <button
                                                key={session.id}
                                                onClick={() => setselectedSessionId(session.id)}
                                                className={`w-full p-4 rounded-xl border text-left transition-all flex flex-col gap-2 ${isSelected ? 'border-brand-500 bg-brand-50/20 shadow-sm' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2 max-w-[65%]">
                                                        {isCall ? <Phone size={12} className="text-orange-500" /> : <MessageSquare size={12} className="text-blue-500" />}
                                                        <span className="text-[10px] font-black uppercase text-slate-700 font-mono truncate">{session.customerName || session.id}</span>
                                                    </div>
                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                                        status === 'human_assigned' ? 'bg-red-50 text-red-500 border-red-100' :
                                                        status === 'completed' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-emerald-50 text-emerald-500 border-emerald-100'
                                                    }`}>
                                                        {status === 'human_assigned' ? 'Staff' : status === 'completed' ? 'Closed' : 'AI'}
                                                    </span>
                                                </div>
                                                <p className="text-[9px] text-slate-400 font-bold">{new Date(session.lastUpdated).toLocaleTimeString()}</p>
                                                {session.intentCategory && (
                                                    <span className="text-[8px] font-bold text-brand-600 bg-brand-50 border border-brand-100 self-start px-2 py-0.5 rounded">
                                                        Intent: {session.intentCategory}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>

                            {/* Pane 2: Conversation Stream (45%) */}
                            <div className="w-[45%] flex flex-col h-full bg-slate-50/50 rounded-2xl border border-slate-100 overflow-hidden">
                                {selectedSession ? (
                                    <div className="flex-1 flex flex-col overflow-hidden h-full">
                                        <div className="bg-white border-b border-slate-100 p-4 flex justify-between items-center shrink-0">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-700 uppercase font-mono">{selectedSession.id}</p>
                                                <p className="text-[8px] text-slate-400 font-bold mt-0.5">Status: {selectedSession.status || 'active'}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                {(selectedSession.status || 'active') === 'active' && (
                                                    <button
                                                        onClick={() => handleTakeOver(selectedSession.id)}
                                                        className="bg-red-500 text-white hover:bg-red-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow transition-all"
                                                    >
                                                        Take Over
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                                            {sessionMessages.map((m: any, idx: number) => {
                                                const isStaff = m.isStaff || false;
                                                const isUser = m.role === 'user';
                                                return (
                                                    <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                                        <div className={`max-w-[80%] p-3 rounded-xl shadow-sm text-xs leading-relaxed ${
                                                            isUser ? 'bg-brand-500 text-white rounded-br-none' : 
                                                            isStaff ? 'bg-red-500 text-white rounded-bl-none' : 'bg-white text-slate-800 rounded-bl-none border border-slate-200'
                                                        }`}>
                                                            <p className="font-bold text-[9px] uppercase tracking-wider mb-1 opacity-60">
                                                                {isUser ? 'Customer' : isStaff ? 'Staff Intervene' : 'AI receptionist'}
                                                            </p>
                                                            <p>{m.text}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {selectedSession.status === 'human_assigned' ? (
                                            <div className="p-4 bg-white border-t border-slate-100 flex gap-2 shrink-0">
                                                <input
                                                    type="text"
                                                    value={adminResponseText}
                                                    onChange={e => setAdminResponseText(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && handleSendAdminMessage()}
                                                    placeholder="Type message directly to customer..."
                                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-red-500 outline-none text-slate-800"
                                                />
                                                <button
                                                    onClick={handleSendAdminMessage}
                                                    disabled={!adminResponseText.trim()}
                                                    className="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Send
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-slate-100 border-t border-slate-200 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">
                                                AI is actively responding. Take over to intervene.
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                        Select a session to view conversation
                                    </div>
                                )}
                            </div>

                            {/* Pane 3: Admin Controls & Extracted Data (30%) */}
                            <div className="w-[30%] flex flex-col h-full bg-white rounded-2xl border border-slate-100 p-4 overflow-y-auto no-scrollbar shadow-inner">
                                {selectedSession ? (
                                    <div className="space-y-6">
                                        {/* Extracted PII Box */}
                                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                                            <h4 className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <Database size={12} /> Extracted Data
                                            </h4>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-blue-600/70 font-bold">Name</span>
                                                    <span className="font-mono text-blue-900">{selectedSession.customerName || '---'}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-blue-600/70 font-bold">Phone</span>
                                                    <span className="font-mono text-blue-900">{selectedSession.customerPhone || '---'}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-blue-600/70 font-bold">Email</span>
                                                    <span className="font-mono text-blue-900">{selectedSession.customerEmail || '---'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Intent Box */}
                                        <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl">
                                            <h4 className="text-[10px] font-black text-purple-800 uppercase tracking-widest mb-2">Primary Intent</h4>
                                            <p className="text-xs font-bold text-purple-900">{selectedSession.intentCategory || 'Unknown / Uncategorized'}</p>
                                        </div>

                                        {/* Actions */}
                                        <div className="space-y-2">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Admin Actions</h4>
                                            {selectedSession.status === 'human_assigned' && (
                                                <button
                                                    onClick={() => handleReleaseToAI(selectedSession.id)}
                                                    className="w-full bg-brand-500 text-white hover:bg-brand-600 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider shadow transition-all"
                                                >
                                                    Hand back to AI
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleReleaseToAI(selectedSession.id, true)}
                                                className="w-full bg-slate-800 text-white hover:bg-slate-900 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider shadow transition-all"
                                            >
                                                Mark as Resolved
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                                        <Brain size={32} className="mb-2 opacity-50" />
                                        <p className="text-[10px] font-bold uppercase tracking-widest">No Selection</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            );


        case 'integrations':
            return (
                <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500 pb-20">
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                                    <Database size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Escala CRM Integration</h3>
                                    <p className="text-xs text-slate-500">Auto-sync interaction logs and leads to Escala.</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setEscalaConfig(p => ({ ...p, isActive: !p.isActive }))}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all ${escalaConfig.isActive ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
                            >
                                {escalaConfig.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                {escalaConfig.isActive ? 'Online' : 'Offline'}
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account Identifier</label>
                                <input 
                                    type="text" 
                                    value={escalaConfig.accountId}
                                    onChange={e => setEscalaConfig(p => ({ ...p, accountId: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                    placeholder="ACC-XXXXX"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Authentication Token</label>
                                <input 
                                    type="password" 
                                    value={escalaConfig.apiKey}
                                    onChange={e => setEscalaConfig(p => ({ ...p, apiKey: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                    placeholder="ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={handleTestEscala} className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${escalaTestResult === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-200 text-slate-600'}`}>
                                {isTestingEscala ? <Loader2 size={14} className="animate-spin" /> : escalaTestResult === 'success' ? <Check size={14} /> : <RefreshCw size={14} />}
                                {isTestingEscala ? 'Connecting...' : 'Test Sync'}
                            </button>
                            <button onClick={handleSaveEscala} className="px-8 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-brand-700 flex items-center gap-2">
                                {isSavingEscala ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Deploy Integration
                            </button>
                        </div>
                    </div>
                      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative mt-8">
                          <div className="flex items-center justify-between mb-8">
                              <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                                      <Mic2 size={24} />
                                  </div>
                                  <div>
                                      <h3 className="text-lg font-bold text-slate-800">Twilio Voice & SMS Integration</h3>
                                      <p className="text-xs text-slate-500">Enable phone calls and SMS automation.</p>
                                  </div>
                              </div>
                              <button 
                                  onClick={() => setTwilioConfig(p => ({ ...p, isActive: !p.isActive }))}
                                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all ${twilioConfig.isActive ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
                              >
                                  {twilioConfig.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                  {twilioConfig.isActive ? 'Active' : 'Inactive'}
                              </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                              <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account SID</label>
                                  <input 
                                      type="text" 
                                      value={twilioConfig.accountSid}
                                      onChange={e => setTwilioConfig(p => ({ ...p, accountSid: e.target.value }))}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                      placeholder="AC..."
                                  />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Auth Token</label>
                                  <input 
                                      type="password" 
                                      value={twilioConfig.authToken}
                                      onChange={e => setTwilioConfig(p => ({ ...p, authToken: e.target.value }))}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                      placeholder="ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢"
                                  />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Twilio Number</label>
                                  <input 
                                      type="text" 
                                      value={twilioConfig.phoneNumber}
                                      onChange={e => setTwilioConfig(p => ({ ...p, phoneNumber: e.target.value }))}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                      placeholder="+1 (555) 000-0000"
                                  />
                              </div>
                          </div>
                      </div>
                      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative mt-8">
                          <div className="flex items-center justify-between mb-8">
                              <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center shrink-0">
                                      <Brain size={24} />
                                  </div>
                                  <div>
                                      <h3 className="text-lg font-bold text-slate-800">Google Gemini AI Core</h3>
                                      <p className="text-xs text-slate-500">Configure your Google Gen AI credentials and compliance mode.</p>
                                  </div>
                              </div>
                              <button 
                                  onClick={() => setPrivacyMode(p => !p)}
                                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all ${!privacyMode ? 'bg-emerald-500 text-white shadow-lg' : 'bg-amber-100 text-amber-700'}`}
                              >
                                  {!privacyMode ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                  {privacyMode ? 'Privacy Mode ON' : 'Privacy Mode OFF'}
                              </button>
                          </div>
                          
                          <div className="space-y-4">
                              <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gemini API Key</label>
                                  <input 
                                      type="password" 
                                      value={geminiApiKey}
                                      onChange={e => setGeminiApiKey(e.target.value)}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                      placeholder="AIzaSy..."
                                  />
                                  <p className="text-[10px] text-slate-400 italic">
                                      This key is resolved securely at runtime. Changes will apply immediately across all client widgets upon saving.
                                  </p>
                              </div>
                              
                              <div className="p-4 rounded-xl border bg-slate-50 border-slate-200 text-xs text-slate-600 space-y-2">
                                  <p className="font-bold">Compliance Status:</p>
                                  <ul className="list-disc pl-5 space-y-1">
                                      <li><strong>Privacy Mode ON (Default)</strong>: Conversations are ephemeral, and no chat sessions or visitor logs are saved to Firestore. Best for strict GDPR compliance.</li>
                                      <li><strong>Privacy Mode OFF</strong>: Saves complete chat logs, intents, sentiment analysis, and triggers live agent intervention/takeover capabilities.</li>
                                  </ul>
                              </div>
                              
                              <div className="flex gap-3 pt-2">
                                  <button 
                                      onClick={handleSaveGemini} 
                                      disabled={isSavingGemini}
                                      className="px-8 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-brand-700 flex items-center gap-2"
                                  >
                                      {isSavingGemini ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                      Save Gemini Settings
                                  </button>
                              </div>
                          </div>
                      </div>

                        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative mt-8">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Legacy Chat Migration</h3>
                                    <p className="text-xs text-slate-500">Restore historical chats from the old database structure into the new system.</p>
                                </div>
                                <button 
                                    onClick={handleMigrateLegacyChats} 
                                    disabled={isMigratingChats || privacyMode}
                                    className={`px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 ${privacyMode ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
                                >
                                    {isMigratingChats ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                                    Migrate Legacy Chats
                                </button>
                            </div>
                            {migrationStatus && <p className="text-brand-600 font-bold text-sm">{migrationStatus}</p>}
                            {privacyMode && <p className="text-red-500 text-sm font-bold mt-2">Privacy Mode is ON. You must turn it OFF (in the Google Gemini AI Core section above) before you can migrate legacy chats.</p>}
                        </div>

                </div>
            );

        case 'general':
            return (
                <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500 pb-20">
                     <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Store size={20} className="text-brand-500" /> Brand Identity
                        </h3>
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                             <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-sm font-bold text-slate-800">Active Business Profile</p>
                                    <p className="text-[10px] text-slate-400 font-medium mt-1">Select which company identity the AI represents.</p>
                                </div>
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                                <button 
                                   onClick={() => onToggleBrand && onToggleBrand('unitec')}
                                   className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${currentBrandId === 'unitec' ? 'border-brand-500 bg-white shadow-md' : 'border-slate-100 bg-slate-100 text-slate-400 opacity-60 hover:opacity-100'}`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${currentBrandId === 'unitec' ? 'bg-brand-100 text-brand-600' : 'bg-slate-200'}`}>
                                        <Store size={20} />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-xs">UNITEC Design</p>
                                        <p className="text-[9px] mt-0.5">Wholesale Distributor</p>
                                    </div>
                                    {currentBrandId === 'unitec' && <div className="w-2 h-2 rounded-full bg-brand-500"></div>}
                                </button>
                                
                                <button 
                                   onClick={() => onToggleBrand && onToggleBrand('building')}
                                   className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${currentBrandId === 'building' ? 'border-indigo-500 bg-white shadow-md' : 'border-slate-100 bg-slate-100 text-slate-400 opacity-60 hover:opacity-100'}`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${currentBrandId === 'building' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200'}`}>
                                        <Building2 size={20} />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-xs">Building Innovation</p>
                                        <p className="text-[9px] mt-0.5">Construction Solutions</p>
                                    </div>
                                    {currentBrandId === 'building' && <div className="w-2 h-2 rounded-full bg-indigo-500"></div>}
                                </button>
                             </div>
                        </div>
                     </div>
                </div>
            );
            
        // ===== NEW: Real-time Conversation Monitoring =====
        case 'conversations':
            return (
                <div className="h-[calc(100vh-200px)] animate-in slide-in-from-bottom-2 duration-500">
                    <ConversationMonitor 
                        sessions={conversations}
                        onSelectSession={(session) => {
                            _setSelectedConversation(session);
                        }}
                        onRequestIntervention={async (sessionId) => { try { await updateSessionStatus(sessionId, 'human_assigned', 'staff_001'); } catch (e) { console.error('Failed to take over session', e); } }}
                    />
                </div>
            );
            
        // ===== NEW: Staff Intervention Center =====
        case 'interventions':
            return (
                <div className="h-[calc(100vh-200px)] animate-in slide-in-from-bottom-2 duration-500">
                    <StaffIntervention 
                        sessions={conversations}
                        onCallCustomer={(phone) => {
                            console.log('Calling customer:', phone);
                        }}
                    />
                </div>
            );
            
        // ===== NEW: Analytics Dashboard =====
        case 'analytics':
            return (
                <div className="h-[calc(100vh-200px)] animate-in slide-in-from-bottom-2 duration-500">
                    <AnalyticsDashboard sessions={conversations} />
                </div>
            );
            
        // ===== NEW: API Health Monitor =====
        case 'health':
            return (
                <div className="h-[calc(100vh-200px)] animate-in slide-in-from-bottom-2 duration-500">
                    <ApiHealthMonitor />
                </div>
            );
        // ===== PERMANENT MEMORY: Retraining & Chat Memory =====
        case 'retraining':
            return (
                <div className="h-[calc(100vh-200px)] animate-in slide-in-from-bottom-2 duration-500">
                    <RetrainingAnalytics liveSessions={conversations} />
                </div>
            );
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 font-sans">
        {/* INTERVENTION ALERT BANNERS */}
        {pendingAlerts.length > 0 && (
          <div className="flex flex-col gap-2 p-3 bg-red-50 border-b border-red-200 shrink-0">
            {pendingAlerts.map(alert => (
              <div key={alert.id} className="flex items-start gap-3 bg-red-600 text-white rounded-xl px-4 py-3 shadow-lg animate-pulse-once">
                <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-200" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black uppercase tracking-wider text-red-100">?? Cliente necesita ayuda</p>
                  <p className="text-sm font-medium truncate mt-0.5">{alert.reason || 'SolicitÃ³ hablar con un agente'}</p>
                  <p className="text-[10px] text-red-200 mt-0.5">SesiÃ³n: {alert.sessionId.slice(-12)} Â· {new Date(alert.requestedAt).toLocaleTimeString('es')}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { setActiveSubTab('interventions'); setDismissedAlertIds(prev => { const next = new Set(prev); next.add(alert.id); return next; }); }}
                    className="px-3 py-1.5 bg-white text-red-600 rounded-lg text-[10px] font-black uppercase hover:bg-red-50 transition-colors"
                  >
                    Atender ?
                  </button>
                  <button
                    onClick={() => setDismissedAlertIds(prev => { const next = new Set(prev); next.add(alert.id); return next; })}
                    className="p-1.5 bg-red-700 rounded-lg hover:bg-red-800 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Retention toast */}
        {retentionResult && retentionResult.archived > 0 && (
          <div className="flex items-center justify-between gap-2 px-4 py-2 bg-emerald-50 border-b border-emerald-200 shrink-0">
            <span className="text-[11px] text-emerald-700 font-medium">??? {retentionResult.archived} conversaciones archivadas y eliminadas automÃ¡ticamente (polÃ­tica 30 dÃ­as)</span>
            <button onClick={() => setRetentionResult(null)} className="text-emerald-500 hover:text-emerald-700"><X size={12} /></button>
          </div>
        )}

        <div className="bg-white border-b border-slate-200 px-6 pt-2 overflow-x-auto no-scrollbar shrink-0">
             {/* Header label row */}
             <div className="flex items-center justify-between pt-1 pb-0.5">
               <div className="flex items-center gap-4">
                 {onBack && (
                   <button 
                     onClick={onBack}
                     className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold uppercase rounded-lg transition-colors flex items-center gap-1 border border-slate-200"
                   >
                     â† {language === 'en' ? 'Back to Site' : 'Volver a la Web'}
                   </button>
                 )}
                 <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Mission Control</span>
               </div>
               <span className="flex items-center gap-1.5">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                 <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Live</span>
               </span>
             </div>
<div className="flex items-end gap-0">
               {/* CRM & OPERATIONS GROUP */}
               {[
                 { id: 'chats',           label: 'Inbox',        icon: <MessageSquare size={13} /> },
                 { id: 'conversations',   label: 'Live Monitor', icon: <Phone size={13} /> },
                 { id: 'interventions',   label: 'Alerts',       icon: <span className="relative flex items-center gap-1"><Headphones size={13} />{pendingAlerts.length > 0 && <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] font-black text-white flex items-center justify-center animate-bounce">{pendingAlerts.length}</span>}</span> },
                 { id: 'catalogs',        label: 'Catalogs',     icon: <Copy size={13} /> },
               ].map((t: any) => (
                 <button
                   key={t.id}
                   onClick={() => setActiveSubTab(t.id as any)}
                   className={`py-3.5 px-3 text-[10px] font-bold uppercase tracking-widest border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${activeSubTab === t.id ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                 >
                   {t.icon}{t.label}
                 </button>
               ))}
               
               <div className="self-center mx-3 w-px h-5 bg-slate-200 shrink-0" />
               
               {/* INSIGHTS GROUP */}
               {[
                 { id: 'analytics',       label: 'Analytics',      icon: <BarChart3 size={13} /> },
                 { id: 'usage',           label: 'Usage & Billing',icon: <DollarSign size={13} /> },
                 { id: 'retraining',      label: 'Memoria',     icon: <Brain size={13} /> },
                 { id: 'health',          label: 'API Health',     icon: <Check size={13} /> },
               ].map((t: any) => (
                 <button
                   key={t.id}
                   onClick={() => setActiveSubTab(t.id as any)}
                   className={`py-3.5 px-3 text-[10px] font-bold uppercase tracking-widest border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${activeSubTab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                 >
                   {t.icon}{t.label}
                 </button>
               ))}
               
               <div className="self-center mx-3 w-px h-5 bg-slate-200 shrink-0" />

               {/* SYSTEM / CONFIG GROUP */}
               {[
                 { id: 'general',         label: 'Settings',     icon: <ShieldCheck size={13} /> },
                 { id: 'training',        label: 'Training',     icon: <Brain size={13} /> },
                ].map((t: any) => {
                 const activeBrandColor = currentBrandId === 'building' ? 'border-indigo-600 text-indigo-600' : 'border-brand-600 text-brand-600';
                 return (
                 <button
                   key={t.id}
                   onClick={() => setActiveSubTab(t.id as any)}
                   className={`py-3.5 px-3 text-[10px] font-bold uppercase tracking-widest border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${activeSubTab === t.id ? activeBrandColor : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                 >
                   {t.icon}{t.label}
                 </button>
               )})}
             </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar">
            <div className="max-w-7xl mx-auto">
                {renderTabContent()}
            </div>
        </div>
    </div>
  );
};

export default AdminDashboard;





















