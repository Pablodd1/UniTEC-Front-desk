
import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Database, Mic2, 
  Save, RefreshCw, Check, Loader2, Volume2, 
  TrendingUp, Zap, Gauge, Building2, Store, Brain, Code, Copy, ExternalLink, Rocket, Globe, ToggleRight, ToggleLeft,
  DollarSign, MessageSquare
} from 'lucide-react';
import { EscalaConfig, VoiceName, VoiceProvider, BillingInvoice } from '../types';
import { playGeminiTTS } from '../services/geminiService';
import { playDeepgramTTS } from '../services/deepgramService';
import { playElevenLabsTTS } from '../services/elevenLabsService';
import { getEscalaConfig, saveEscalaConfig, testEscalaConnection } from '../services/escalaService';
import { getUsageStats, getProfitEstimate, generateInvoice } from '../services/usageService';
import { DEFAULT_TRAINING_DATA } from '../constants';

interface AdminDashboardProps {
  emergencyMode: boolean;
  setEmergencyMode: (val: boolean) => void;
  voiceName: VoiceName;
  setVoiceName: (voice: VoiceName) => void;
  voiceProvider: VoiceProvider;
  setVoiceProvider: (provider: VoiceProvider) => void;
  deepgramKey: string;
  setDeepgramKey: (key: string) => void;
  currentBrandId?: 'unitec' | 'building';
  onToggleBrand?: (brand: 'unitec' | 'building') => void;
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
    deepgramKey,
    currentBrandId = 'unitec',
    onToggleBrand
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'usage' | 'voice' | 'integrations' | 'deploy' | 'training' | 'general' | 'chats'>('usage');
  
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
  const [isTestingEscala, setIsTestingEscala] = useState(false);
  const [escalaTestResult, setEscalaTestResult] = useState<'success' | 'error' | null>(null);
  const [isSavingEscala, setIsSavingEscala] = useState(false);

  // Voice Lab States
  const [isTestingVoice, setIsTestingVoice] = useState<string | null>(null);
  
  // ElevenLabs State
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState('');

  // Model Training State
  const [trainingData, setTrainingData] = useState<string>('');
  const [isSavingTraining, setIsSavingTraining] = useState(false);

  // Copy State
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const geminiVoices: VoiceName[] = ['Aoede', 'Kore', 'Zephyr', 'Puck', 'Fenrir', 'Charon'];
  const [customClones, setCustomClones] = useState<string[]>([]);
  
  useEffect(() => {
    const savedClones = localStorage.getItem('unitec_voice_clones');
    if (savedClones) setCustomClones(JSON.parse(savedClones));
    const storedLib = localStorage.getItem('unitec_call_library');
    if (storedLib) {
        // Recordings loaded but not used in this view currently
    }
    setEscalaConfig(getEscalaConfig());
    
    // Load Training Data: Use LocalStorage if available, otherwise default to Building Innovation data
    const storedTraining = localStorage.getItem('unitec_training_data');
    if (storedTraining && storedTraining.length > 50) {
        setTrainingData(storedTraining);
    } else {
        setTrainingData(DEFAULT_TRAINING_DATA);
    }
    
    setElevenLabsKey(localStorage.getItem('unitec_elevenlabs_key') || '');
    setElevenLabsVoiceId(localStorage.getItem('unitec_elevenlabs_voice_id') || '');

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
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(id);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const saveElevenLabsConfig = () => {
    localStorage.setItem('unitec_elevenlabs_key', elevenLabsKey);
    localStorage.setItem('unitec_elevenlabs_voice_id', elevenLabsVoiceId);
    if(elevenLabsVoiceId) {
        setVoiceName(elevenLabsVoiceId);
        setVoiceProvider('elevenlabs');
    }
  };

  const handleTestVoice = async (v: VoiceName) => {
    if (isTestingVoice) return;
    setIsTestingVoice(v);
    try {
        if (voiceProvider === 'gemini') {
            await playGeminiTTS("Hello! This is a test of my voice responsiveness.", v);
        } else if (voiceProvider === 'elevenlabs') {
            await playElevenLabsTTS("Hello! This is my cloned voice.", elevenLabsKey, v || elevenLabsVoiceId);
        } else {
            await playDeepgramTTS("Channel test.", deepgramKey, v, () => {}, () => {});
        }
        
        if (voiceProvider === 'gemini') setTimeout(() => setIsTestingVoice(null), 3000);
        else setTimeout(() => setIsTestingVoice(null), 1000);

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

  const handleSaveEscala = () => {
    setIsSavingEscala(true);
    saveEscalaConfig(escalaConfig);
    setTimeout(() => setIsSavingEscala(false), 800);
  };

  const handleSaveTraining = () => {
    setIsSavingTraining(true);
    localStorage.setItem('unitec_training_data', trainingData);
    setTimeout(() => setIsSavingTraining(false), 1000);
  };

  const currentVoiceList = [...geminiVoices, ...customClones];

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

                    {/* Recent Interactions (CRM Logs) */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Recent Interactions</h3>
                        <div className="space-y-3">
                            {[
                                { date: '2026-03-13 10:23 AM', user: 'Client A', action: 'Inquired about Cement pricing', status: 'Logged' },
                                { date: '2026-03-13 09:45 AM', user: 'Client B', action: 'Booked consultation call', status: 'Synced' },
                                { date: '2026-03-12 04:12 PM', user: 'Client C', action: 'Requested technical sheet for Steel Rebar', status: 'Logged' },
                                { date: '2026-03-12 01:30 PM', user: 'Client D', action: 'Asked about delivery times to Miami', status: 'Synced' },
                            ].map((log, i) => (
                                <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-slate-800">{log.user}</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">{log.action}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400">{log.date}</p>
                                        <span className={`inline-block mt-1 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                            log.status === 'Synced' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                                        }`}>
                                            {log.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
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
                                <button 
                                  onClick={() => setVoiceProvider('elevenlabs')}
                                  className={`px-4 py-2 rounded-lg text-xs font-bold border ${voiceProvider === 'elevenlabs' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500'}`}
                                >
                                  ElevenLabs (Cloned)
                                </button>
                            </div>
                        </div>

                        {voiceProvider === 'elevenlabs' && (
                             <div className="mb-8 p-6 bg-indigo-50 rounded-xl border border-indigo-100 space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Globe size={16} className="text-indigo-600" />
                                    <h4 className="font-bold text-indigo-900 text-sm">Voice Cloning Setup</h4>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">ElevenLabs API Key</label>
                                    <input 
                                        type="password" 
                                        value={elevenLabsKey}
                                        onChange={(e) => setElevenLabsKey(e.target.value)}
                                        className="w-full mt-1 px-4 py-2 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                        placeholder="xi-..."
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Voice ID</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={elevenLabsVoiceId}
                                            onChange={(e) => setElevenLabsVoiceId(e.target.value)}
                                            className="flex-1 mt-1 px-4 py-2 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                            placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
                                        />
                                        <button onClick={saveElevenLabsConfig} className="mt-1 px-4 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">
                                            Save
                                        </button>
                                    </div>
                                </div>
                             </div>
                        )}

                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Persona Library</h3>
                            <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                                <Gauge size={12} className="text-emerald-600" />
                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                                    {voiceProvider === 'elevenlabs' ? 'Standard Latency' : 'Flash Native Speed'}
                                </span>
                            </div>
                        </div>
                        
                        {voiceProvider === 'gemini' && (
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
                                                            {details.style} • {details.gender}
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
                        )}
                        
                        {voiceProvider === 'elevenlabs' && (
                             <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                                <Mic2 size={48} className="mx-auto mb-4 text-indigo-300" />
                                <p className="font-bold text-slate-600">Using Cloned Voice ID</p>
                                <p className="text-xs mt-1 font-mono bg-white px-2 py-1 rounded inline-block border border-slate-200">{elevenLabsVoiceId || "No ID Set"}</p>
                                <div className="mt-4">
                                    <button onClick={() => handleTestVoice(elevenLabsVoiceId)} className="px-6 py-2 bg-indigo-600 text-white rounded-full text-sm font-bold hover:bg-indigo-700 flex items-center gap-2 mx-auto">
                                       {isTestingVoice ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
                                       Test Clone
                                    </button>
                                </div>
                             </div>
                        )}
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
                                    <p className="text-xs text-slate-500 mt-1">In Vercel Dashboard → Settings → Environment Variables, add:</p>
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

        case 'chats':
            const savedChats = localStorage.getItem('unitec_chat_history');
            let parsedChats = [];
            try {
                if (savedChats) parsedChats = JSON.parse(savedChats);
            } catch (e) {}

            return (
                <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500 pb-20">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Training Opportunities</h3>
                                <p className="text-xs text-slate-500">Review recent chat logs to improve AI responses and update the knowledge base.</p>
                            </div>
                        </div>
                        
                        {parsedChats.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 text-sm">No chat history found.</div>
                        ) : (
                            <div className="space-y-4">
                                {parsedChats.map((msg: any, i: number) => (
                                    <div key={i} className={`p-4 rounded-xl border ${msg.role === 'user' ? 'bg-brand-50 border-brand-100 ml-8' : 'bg-slate-50 border-slate-100 mr-8'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${msg.role === 'user' ? 'text-brand-600' : 'text-slate-500'}`}>
                                                {msg.role === 'user' ? 'User' : 'AI Assistant'}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                {new Date(msg.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{msg.text}</p>
                                    </div>
                                ))}
                            </div>
                        )}
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
                                    placeholder="••••••••••••••••"
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
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 font-sans">
        <div className="bg-white border-b border-slate-200 px-6 pt-2 overflow-x-auto no-scrollbar shrink-0">
             <div className="flex gap-8">
                 {[
                    { id: 'usage', label: 'Usage & Billing', icon: <DollarSign size={14} /> },
                    { id: 'voice', label: 'Voice', icon: <Mic2 size={14} /> },
                    { id: 'training', label: 'Training', icon: <Brain size={14} /> },
                    { id: 'chats', label: 'Chats', icon: <MessageSquare size={14} /> },
                    { id: 'deploy', label: 'Deploy', icon: <Rocket size={14} /> },
                    { id: 'integrations', label: 'CRM', icon: <Database size={14} /> },
                    { id: 'general', label: 'Settings', icon: <ShieldCheck size={14} /> }
                 ].map(t => (
                    <button 
                        key={t.id}
                        onClick={() => setActiveSubTab(t.id as any)} 
                        className={`py-4 text-xs font-bold uppercase tracking-widest border-b-2 flex items-center gap-2 transition-all ${activeSubTab === t.id ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        {t.icon}
                        {t.label}
                    </button>
                 ))}
             </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
            <div className="max-w-4xl mx-auto">
                {renderTabContent()}
            </div>
        </div>
    </div>
  );
};

export default AdminDashboard;
