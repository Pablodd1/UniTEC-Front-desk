
import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, Activity, Database, Power, Mic2, UploadCloud, Key, Globe, 
  Save, Cpu, HardDrive, RefreshCw, Check, Loader2, Volume2, Download, 
  Pause, Play, Music, CheckCircle2, Server, Headphones, ToggleLeft, 
  ToggleRight, AlertCircle, TrendingUp, Zap, CreditCard, PieChart, 
  Receipt, FileText, Plus, BarChart3, Trash2, DollarSign, Gauge, Building2, Store, Brain, Code, Copy
} from 'lucide-react';
import { CrmLog, VoiceName, VoiceProvider, UsageStats, EscalaConfig, CallRecording, BillingInvoice } from '../types';
import { playGeminiTTS } from '../services/geminiService';
import { playDeepgramTTS } from '../services/deepgramService';
import { playElevenLabsTTS } from '../services/elevenLabsService';
import { getEscalaConfig, saveEscalaConfig, testEscalaConnection } from '../services/escalaService';
import { getUsageStats, resetUsage, generateInvoice, getProfitEstimate } from '../services/usageService';

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
    emergencyMode, setEmergencyMode, 
    voiceName, setVoiceName,
    voiceProvider, setVoiceProvider,
    deepgramKey, setDeepgramKey,
    currentBrandId = 'unitec',
    onToggleBrand
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'usage' | 'voice' | 'integrations' | 'deploy' | 'training' | 'general'>('usage');
  const [recordings, setRecordings] = useState<CallRecording[]>([]);
  
  // Usage & Billing State
  const [usage, setUsage] = useState<UsageStats>(getUsageStats());
  const [profit, setProfit] = useState<number>(getProfitEstimate());
  const [isRefreshingUsage, setIsRefreshingUsage] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  // Escala CRM State
  const [escalaConfig, setEscalaConfig] = useState<EscalaConfig>({ apiKey: '', accountId: '', isActive: false });
  const [isTestingEscala, setIsTestingEscala] = useState(false);
  const [escalaTestResult, setEscalaTestResult] = useState<'success' | 'error' | null>(null);
  const [isSavingEscala, setIsSavingEscala] = useState(false);

  // Voice Lab States
  const [voiceUploadStatus, setVoiceUploadStatus] = useState<'idle' | 'uploading' | 'success'>('idle');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isTestingVoice, setIsTestingVoice] = useState<string | null>(null);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);
  
  // ElevenLabs State
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState('');

  // Model Training State
  const [trainingData, setTrainingData] = useState<string>('');
  const [isSavingTraining, setIsSavingTraining] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const geminiVoices: VoiceName[] = ['Aoede', 'Kore', 'Zephyr', 'Puck', 'Fenrir', 'Charon'];
  const [customClones, setCustomClones] = useState<string[]>([]);
  
  useEffect(() => {
    const savedClones = localStorage.getItem('unitec_voice_clones');
    if (savedClones) setCustomClones(JSON.parse(savedClones));
    const storedLib = localStorage.getItem('unitec_call_library');
    if (storedLib) setRecordings(JSON.parse(storedLib));
    setEscalaConfig(getEscalaConfig());
    
    // Load Training Data
    const storedTraining = localStorage.getItem('unitec_training_data');
    if (storedTraining) setTrainingData(storedTraining);
    
    // Load ElevenLabs
    setElevenLabsKey(localStorage.getItem('unitec_elevenlabs_key') || '');
    setElevenLabsVoiceId(localStorage.getItem('unitec_elevenlabs_voice_id') || '');

    const interval = setInterval(() => {
      setUsage(getUsageStats());
      setProfit(getProfitEstimate());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleRefreshUsage = () => {
    setIsRefreshingUsage(true);
    setTimeout(() => {
        setUsage(getUsageStats());
        setProfit(getProfitEstimate());
        setIsRefreshingUsage(false);
    }, 600);
  };

  const handleCreateInvoice = () => {
    setIsGeneratingInvoice(true);
    setTimeout(() => {
      generateInvoice();
      setUsage(getUsageStats());
      setIsGeneratingInvoice(false);
    }, 1200);
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
    setTestFeedback(null);
    try {
        if (voiceProvider === 'gemini') {
            await playGeminiTTS("Hello! This is a test of my voice responsiveness.", v);
            setTestFeedback(`${v} connected.`);
        } else if (voiceProvider === 'elevenlabs') {
            await playElevenLabsTTS("Hello! This is my cloned voice.", elevenLabsKey, v || elevenLabsVoiceId);
            setTestFeedback("Cloned voice active.");
        } else {
            // Deepgram fallback
            await playDeepgramTTS("Channel test.", deepgramKey, v, () => {}, () => {});
        }
        
        if (voiceProvider === 'gemini') setTimeout(() => setIsTestingVoice(null), 3000);
        else setTimeout(() => setIsTestingVoice(null), 1000);

    } catch (e) {
        setIsTestingVoice(null);
        setTestFeedback("Error testing voice.");
    }
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
            const tokenProgress = Math.min(100, (usage.totalTokens / usage.limitTokens) * 100);
            return (
                <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500 pb-20">
                    {/* Top Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-brand-900 to-slate-900 p-6 rounded-2xl text-white shadow-xl relative overflow-hidden group">
                            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-125 transition-transform"><TrendingUp size={120} /></div>
                            <div className="relative z-10">
                                <span className="text-[10px] font-bold text-brand-300 uppercase tracking-widest">Client Billable</span>
                                <h4 className="text-4xl font-black mt-2">${usage.costEstimate.toFixed(2)}</h4>
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
                            <h4 className="text-3xl font-bold text-slate-800">{(usage.totalTokens / 1000).toFixed(1)}k</h4>
                            <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden">
                                <div className="bg-brand-500 h-full transition-all duration-1000 shadow-sm" style={{ width: `${tokenProgress}%` }}></div>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Voice Connect</span>
                                <Mic2 size={14} className="text-orange-500" />
                            </div>
                            <h4 className="text-3xl font-bold text-slate-800">{usage.minutesUsed.toFixed(1)}m</h4>
                            <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase">Real-time Call Time</p>
                        </div>
                    </div>

                    {/* Breakdown Chart */}
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
                                { label: 'Chat Processing (Input/Output)', val: usage.chatTokens, max: 1000000, color: 'bg-brand-500' },
                                { label: 'Neural Voice Synthesis (Minutes)', val: Math.floor(usage.minutesUsed), max: 500, color: 'bg-orange-400' },
                                { label: 'API System Overhead', val: usage.apiCalls, max: 2000, color: 'bg-emerald-400' }
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
                    </div>
                </div>
            );

        case 'deploy':
            const currentUrl = window.location.origin;
            const embedCode = `<iframe src="${currentUrl}" width="400" height="700" style="border:none; position:fixed; bottom:20px; right:20px; z-index:9999; border-radius:24px; box-shadow: 0 10px 40px rgba(0,0,0,0.15);"></iframe>`;
            
            return (
                <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500 pb-20">
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                                <Code size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Website Integration</h3>
                                <p className="text-xs text-slate-500">Embed this AI Assistant on any website.</p>
                            </div>
                        </div>

                        <div className="bg-slate-900 rounded-xl p-6 relative group">
                            <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-all">
                                {embedCode}
                            </pre>
                            <button 
                                onClick={() => navigator.clipboard.writeText(embedCode)}
                                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                            >
                                <Copy size={16} />
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-4 text-center">
                            Copy this code and paste it before the closing <code>&lt;/body&gt;</code> tag of your website.
                        </p>
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

                     <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <ShieldCheck size={20} className="text-brand-500" /> Security Controls
                        </h3>
                        <div className="flex items-center justify-between p-6 rounded-2xl bg-slate-50 border border-slate-100">
                            <div>
                                <p className="text-sm font-bold text-slate-800">Master Emergency Lockdown</p>
                                <p className="text-[10px] text-slate-400 font-medium mt-1">Force AI to prioritize safety protocols and skip detailed inquiries.</p>
                            </div>
                            <button 
                                onClick={() => setEmergencyMode(!emergencyMode)}
                                className={`w-14 h-8 rounded-full p-1 transition-colors ${emergencyMode ? 'bg-red-500' : 'bg-slate-300'}`}
                            >
                                <div className={`w-6 h-6 rounded-full bg-white shadow transition-transform ${emergencyMode ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
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
                    { id: 'usage', label: 'Usage', icon: <DollarSign size={14} /> },
                    { id: 'voice', label: 'Voice Config', icon: <Mic2 size={14} /> },
                    { id: 'training', label: 'Training', icon: <Brain size={14} /> },
                    { id: 'deploy', label: 'Deploy', icon: <Code size={14} /> },
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
