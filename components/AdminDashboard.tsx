
import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, Activity, Database, Power, Mic2, UploadCloud, Key, Globe, 
  Save, Cpu, HardDrive, RefreshCw, Check, Loader2, Volume2, Download, 
  Pause, Play, Music, CheckCircle2, Server, Headphones, ToggleLeft, 
  ToggleRight, AlertCircle, TrendingUp, Zap, CreditCard, PieChart, 
  Receipt, FileText, Plus, BarChart3, Trash2, DollarSign, Gauge, Building2, Store
} from 'lucide-react';
import { CrmLog, VoiceName, VoiceProvider, UsageStats, EscalaConfig, CallRecording, BillingInvoice } from '../types';
import { playGeminiTTS } from '../services/geminiService';
import { playDeepgramTTS } from '../services/deepgramService';
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
  const [activeSubTab, setActiveSubTab] = useState<'usage' | 'voice' | 'integrations' | 'general'>('usage');
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
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const geminiVoices: VoiceName[] = ['Aoede', 'Kore', 'Zephyr', 'Puck', 'Fenrir', 'Charon'];
  const deepgramVoices: VoiceName[] = ['asteria-en', 'luna-en', 'orion-en', 'arcas-en'];
  const [customClones, setCustomClones] = useState<string[]>([]);
  
  useEffect(() => {
    const savedClones = localStorage.getItem('unitec_voice_clones');
    if (savedClones) setCustomClones(JSON.parse(savedClones));
    const storedLib = localStorage.getItem('unitec_call_library');
    if (storedLib) setRecordings(JSON.parse(storedLib));
    setEscalaConfig(getEscalaConfig());
    
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

  const handleTestVoice = async (v: VoiceName) => {
    if (isTestingVoice) return;
    setIsTestingVoice(v);
    setTestFeedback(null);
    try {
        if (voiceProvider === 'gemini') {
            await playGeminiTTS("Hello! This is a test of my voice responsiveness.", v);
            setTestFeedback(`${v} connected.`);
        } else {
            await playDeepgramTTS("Channel test.", deepgramKey, v, () => {}, () => {
              setIsTestingVoice(null);
              setTestFeedback(`${v.replace('-en', '')} ready.`);
            });
        }
        if (voiceProvider === 'gemini') setTimeout(() => setIsTestingVoice(null), 3000);
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

                    {/* Invoicing Section */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                             <div>
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Receipt size={18} className="text-brand-600" /> Professional Billing History
                                </h3>
                                <p className="text-[10px] text-slate-500 mt-0.5">Exportable statements for client invoicing.</p>
                             </div>
                             <button 
                                onClick={handleCreateInvoice}
                                disabled={isGeneratingInvoice}
                                className="px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700 transition-all shadow-md flex items-center gap-2"
                             >
                                {isGeneratingInvoice ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                New Invoice
                             </button>
                        </div>
                        <div className="overflow-x-auto">
                            {usage.billingHistory && usage.billingHistory.length > 0 ? (
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4">ID</th>
                                            <th className="px-6 py-4">Generated</th>
                                            <th className="px-6 py-4 text-right">Units</th>
                                            <th className="px-6 py-4 text-right">Total Owed</th>
                                            <th className="px-6 py-4 text-center">Export</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {usage.billingHistory.map((inv) => (
                                            <tr key={inv.id} className="hover:bg-slate-50/50">
                                                <td className="px-6 py-4 text-xs font-bold text-slate-700">{inv.id}</td>
                                                <td className="px-6 py-4 text-xs text-slate-500">{inv.date}</td>
                                                <td className="px-6 py-4 text-xs text-right text-slate-500">{(inv.tokens / 1000).toFixed(1)}k</td>
                                                <td className="px-6 py-4 text-xs font-bold text-right text-brand-600">${inv.amount.toFixed(2)}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <button className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 transition-colors">
                                                      <Download size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-16 text-center text-slate-400">
                                    <FileText size={48} className="mx-auto mb-4 opacity-10" />
                                    <p className="text-sm font-medium italic">Ready to bill. Generate an invoice to begin.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex justify-center">
                        <button 
                            onClick={() => { if(confirm("This will clear ALL billing history. Continue?")) { resetUsage(); setUsage(getUsageStats()); } }}
                            className="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-widest flex items-center gap-1"
                        >
                            <Trash2 size={12} /> Clear Billing System
                        </button>
                    </div>
                </div>
            );

        case 'voice':
            return (
                <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500 pb-20">
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Persona Library</h3>
                            <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                                <Gauge size={12} className="text-emerald-600" />
                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Flash Native Speed: Active</span>
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
                    { id: 'usage', label: 'Usage & Billing', icon: <DollarSign size={14} /> },
                    { id: 'voice', label: 'Voice Config', icon: <Mic2 size={14} /> },
                    { id: 'integrations', label: 'CRM Sync', icon: <Database size={14} /> },
                    { id: 'general', label: 'Config & Security', icon: <ShieldCheck size={14} /> }
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
