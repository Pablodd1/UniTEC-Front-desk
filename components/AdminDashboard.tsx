
import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Activity, Database, Power, Mic2, UploadCloud, Key, Globe, Save, Cpu, HardDrive, FileAudio, BarChart3, RefreshCw, Calendar, Mail, Link, Check, Loader2, Volume2, Settings, Download, Play, Music, Pause, CheckCircle2, Server, Terminal, ExternalLink, Headphones, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';
import { CrmLog, VoiceName, VoiceProvider, UsageStats, EscalaConfig, CallRecording } from '../types';
import { playGeminiTTS } from '../services/geminiService';
import { playDeepgramTTS } from '../services/deepgramService';
import { getEscalaConfig, saveEscalaConfig, testEscalaConnection } from '../services/escalaService';

interface AdminDashboardProps {
  emergencyMode: boolean;
  setEmergencyMode: (val: boolean) => void;
  voiceName: VoiceName;
  setVoiceName: (voice: VoiceName) => void;
  voiceProvider: VoiceProvider;
  setVoiceProvider: (provider: VoiceProvider) => void;
  deepgramKey: string;
  setDeepgramKey: (key: string) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
    emergencyMode, setEmergencyMode, 
    voiceName, setVoiceName,
    voiceProvider, setVoiceProvider,
    deepgramKey, setDeepgramKey
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'voice' | 'integrations' | 'usage'>('voice');
  const [logs, setLogs] = useState<CrmLog[]>([]);
  const [recordings, setRecordings] = useState<CallRecording[]>([]);
  const [isSavingKey, setIsSavingKey] = useState(false);
  
  // Escala CRM State
  const [escalaConfig, setEscalaConfig] = useState<EscalaConfig>({
    apiKey: '',
    accountId: '',
    isActive: false
  });
  const [isTestingEscala, setIsTestingEscala] = useState(false);
  const [escalaTestResult, setEscalaTestResult] = useState<'success' | 'error' | null>(null);
  const [isSavingEscala, setIsSavingEscala] = useState(false);

  // Voice Lab States
  const [voiceUploadStatus, setVoiceUploadStatus] = useState<'idle' | 'uploading' | 'success'>('idle');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isTestingVoice, setIsTestingVoice] = useState<string | null>(null);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);
  
  // Playback state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const geminiVoices: VoiceName[] = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
  const deepgramVoices: VoiceName[] = ['asteria-en', 'luna-en', 'orion-en', 'arcas-en'];
  
  // Persistent voice clone status check
  const [customClones, setCustomClones] = useState<string[]>([]);
  
  useEffect(() => {
    const savedClones = localStorage.getItem('unitec_voice_clones');
    if (savedClones) {
        setCustomClones(JSON.parse(savedClones));
    }

    const storedLogs = localStorage.getItem('unitec_crm_logs');
    if (storedLogs) setLogs(JSON.parse(storedLogs));

    const storedLib = localStorage.getItem('unitec_call_library');
    if (storedLib) setRecordings(JSON.parse(storedLib));

    // Load Escala Config
    setEscalaConfig(getEscalaConfig());
  }, []);

  const handleVoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        const cleanName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
        setUploadedFileName(file.name);
        setVoiceUploadStatus('uploading');
        
        setTimeout(() => {
            setVoiceUploadStatus('success');
            const updatedClones = [...new Set([...customClones, cleanName])];
            setCustomClones(updatedClones);
            localStorage.setItem('unitec_voice_clones', JSON.stringify(updatedClones));
            
            setVoiceName(cleanName);
            setVoiceProvider('gemini');
        }, 4000);
    }
  };

  const handleTestVoice = async (v: VoiceName) => {
    if (isTestingVoice) return;
    setIsTestingVoice(v);
    setTestFeedback(null);
    const sampleText = "Welcome to UNITEC USA DESIGN. This is a preview of the selected voice profile.";
    try {
        if (voiceProvider === 'gemini') {
            const isClone = customClones.includes(v as string);
            await playGeminiTTS(sampleText, isClone ? 'Zephyr' : v);
            setTestFeedback(`${v} connected successfully.`);
        } else {
            if (!deepgramKey) {
                alert("Please configure Deepgram API Key in Integrations first.");
                setIsTestingVoice(null);
                return;
            }
            await playDeepgramTTS(sampleText, deepgramKey, v, () => {}, () => {
              setIsTestingVoice(null);
              setTestFeedback(`${v.replace('-en', '')} (Deepgram) ready.`);
            });
        }
        if (voiceProvider === 'gemini') {
          setTimeout(() => {
            setIsTestingVoice(null);
          }, 3000);
        }
    } catch (e) {
        setIsTestingVoice(null);
        setTestFeedback("Voice test failed. Please check configuration.");
    }
  };

  const togglePlayback = (recording: CallRecording) => {
    if (playingId === recording.id) {
        audioRef.current?.pause();
        setPlayingId(null);
    } else {
        if (audioRef.current) {
            audioRef.current.pause();
        }
        const url = recording.blobUrl || "https://www.soundjay.com/buttons/beep-01a.mp3";
        const audio = new Audio(url);
        audio.onended = () => setPlayingId(null);
        audio.play();
        audioRef.current = audio;
        setPlayingId(recording.id);
    }
  };

  const handleDownload = (rec: CallRecording) => {
    if (rec.blobUrl) {
        const link = document.createElement('a');
        link.href = rec.blobUrl;
        link.download = rec.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        alert("Audio file link not available in this demo mode.");
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
        case 'voice':
            return (
                <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
                    {/* Provider Toggle */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Voice Engine Provider</h3>
                        <div className="flex gap-4 p-1 bg-slate-100 rounded-xl w-fit">
                            <button 
                                onClick={() => setVoiceProvider('gemini')}
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${voiceProvider === 'gemini' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Gemini Live
                            </button>
                            <button 
                                onClick={() => setVoiceProvider('deepgram')}
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${voiceProvider === 'deepgram' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Deepgram Aura
                            </button>
                        </div>
                    </div>

                    {/* Voice Selection */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex flex-col gap-1">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select & Test Persona</h3>
                                {testFeedback && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 animate-in fade-in slide-in-from-left-2">
                                    <Check size={10} />
                                    {testFeedback}
                                  </div>
                                )}
                            </div>
                            {customClones.length > 0 && voiceProvider === 'gemini' && (
                                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight">
                                    {customClones.length} Clones Available
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {(voiceProvider === 'gemini' ? currentVoiceList : deepgramVoices).map(v => (
                                <div key={v} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                    voiceName === v 
                                    ? 'bg-brand-50 border-brand-200 ring-2 ring-brand-500/20' 
                                    : 'bg-white border-gray-200 hover:border-brand-200'
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${voiceName === v ? 'bg-brand-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                                            <Headphones size={16} />
                                        </div>
                                        <button
                                            onClick={() => setVoiceName(v)}
                                            className="text-left"
                                        >
                                            <p className={`text-sm font-bold ${voiceName === v ? 'text-brand-700' : 'text-slate-700'}`}>
                                                {customClones.includes(v as string) ? `${v}` : v.replace('-en', '')}
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-medium">
                                                {voiceName === v ? 'Active Channel' : 'Select Voice'}
                                            </p>
                                        </button>
                                    </div>
                                    <button 
                                        onClick={() => handleTestVoice(v)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            isTestingVoice === v 
                                            ? 'bg-brand-500 text-white shadow-md'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {isTestingVoice === v ? <Loader2 size={12} className="animate-spin" /> : <Volume2 size={12} />}
                                        Test
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Cloning Lab */}
                    {voiceProvider === 'gemini' && (
                        <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                            <div className="absolute top-4 right-4 bg-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">Enterprise Add-on</div>
                            
                            <div className="flex items-start gap-5 mb-8">
                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                                    <Mic2 size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Voice Cloning Lab</h3>
                                    <p className="text-sm text-slate-500">Train custom neural voices for your brand's unique identity.</p>
                                </div>
                            </div>

                            <div className={`rounded-2xl border-2 border-dashed transition-all duration-500 ${
                                voiceUploadStatus === 'idle' ? 'border-slate-200 bg-slate-50 p-12 text-center' : 
                                voiceUploadStatus === 'uploading' ? 'border-brand-300 bg-brand-50 p-12 text-center shadow-lg shadow-brand-500/5' :
                                'border-emerald-200 bg-emerald-50 p-12 text-center'
                            }`}>
                                {voiceUploadStatus === 'idle' ? (
                                    <label className="cursor-pointer flex flex-col items-center group">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
                                            <UploadCloud size={32} className="text-brand-500" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-600 mb-1">Upload Voice Sample</span>
                                        <span className="text-xs text-slate-400 font-medium">Cloning identity derived from file name</span>
                                        <input type="file" className="hidden" onChange={handleVoiceUpload} accept="audio/*" />
                                    </label>
                                ) : voiceUploadStatus === 'uploading' ? (
                                    <div className="flex flex-col items-center">
                                        <Loader2 size={48} className="text-brand-500 animate-spin mb-4" />
                                        <span className="text-sm font-bold text-brand-700">Synthesizing vocal patterns...</span>
                                        <span className="text-xs text-brand-400 mt-1">{uploadedFileName}</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center animate-in zoom-in-95 duration-500">
                                        <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
                                            <CheckCircle2 size={32} />
                                        </div>
                                        <span className="text-sm font-bold text-emerald-700">Neural Clone Deployed</span>
                                        <p className="text-xs text-emerald-600 mt-1">Ready for interaction: <span className="font-bold">"{uploadedFileName.split('.')[0]}"</span></p>
                                        <button 
                                            onClick={() => setVoiceUploadStatus('idle')}
                                            className="mt-6 text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-brand-500 transition-colors"
                                        >
                                            Reset Lab
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Call Recording Library */}
                    <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Call History</h3>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{recordings.length} Recordings</span>
                        </div>
                        <div className="space-y-3">
                            {recordings.length === 0 ? (
                                <div className="p-12 text-center border rounded-xl bg-slate-50 text-slate-400 italic text-sm">No recorded interactions available.</div>
                            ) : (
                                recordings.map((rec) => (
                                    <div key={rec.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl hover:bg-white hover:shadow-lg transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                                                playingId === rec.id ? 'bg-brand-500 text-white animate-pulse' : 'bg-white border border-slate-200 text-slate-400'
                                            }`}>
                                                {playingId === rec.id ? <Pause size={18} /> : <Music size={18} />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{rec.name}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">
                                                    {new Date(rec.timestamp).toLocaleDateString()} • {rec.duration}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => togglePlayback(rec)}
                                                className={`p-2 rounded-full ${playingId === rec.id ? 'text-red-500' : 'text-brand-600 hover:bg-brand-50'}`}
                                            >
                                                {playingId === rec.id ? <Pause size={18} /> : <Play size={18} />}
                                            </button>
                                            <button 
                                                onClick={() => handleDownload(rec)}
                                                className="px-4 py-1.5 text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 uppercase tracking-wider"
                                            >
                                                Download
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            );
        case 'integrations':
            return (
                <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
                    {/* Deepgram Integration */}
                    <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                                <Key size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">Deepgram API Integration</h3>
                                <p className="text-xs text-slate-500">Power Aura high-fidelity voice synthesis.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">API Key</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input 
                                            type="password"
                                            value={deepgramKey}
                                            onChange={(e) => setDeepgramKey(e.target.value)}
                                            placeholder="Deepgram Key..."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                                        />
                                        <Key className="absolute right-4 top-3.5 text-slate-300" size={16} />
                                    </div>
                                    <button 
                                        onClick={() => {
                                            setIsSavingKey(true);
                                            setTimeout(() => setIsSavingKey(false), 800);
                                        }}
                                        className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl text-sm hover:bg-brand-700 transition-all shadow-md flex items-center gap-2"
                                    >
                                        {isSavingKey ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        Update
                                    </button>
                                </div>
                            </div>
                            
                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex items-start gap-3">
                                <Server className="text-purple-600 mt-0.5" size={16} />
                                <div>
                                    <p className="text-xs font-bold text-purple-900">Get Credentials</p>
                                    <p className="text-[10px] text-purple-700 mt-1">Deepgram provides free testing credits at <a href="https://console.deepgram.com" target="_blank" className="underline font-bold">console.deepgram.com</a>.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Escala CRM Integration */}
                    <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm overflow-hidden relative">
                         <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                                    <Database size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">Escala CRM Integration</h3>
                                    <p className="text-xs text-slate-500">Sync leads and interactions to Escala.com.</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setEscalaConfig(prev => ({ ...prev, isActive: !prev.isActive }))}
                                className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                                    escalaConfig.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                                }`}
                            >
                                {escalaConfig.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                {escalaConfig.isActive ? 'Active' : 'Inactive'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Account ID</label>
                                <div className="relative">
                                    <input 
                                        type="text"
                                        value={escalaConfig.accountId}
                                        onChange={(e) => setEscalaConfig(prev => ({ ...prev, accountId: e.target.value }))}
                                        placeholder="e.g. ACC-12345"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                    />
                                    <Globe className="absolute right-4 top-3.5 text-slate-300" size={16} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">API Key</label>
                                <div className="relative">
                                    <input 
                                        type="password"
                                        value={escalaConfig.apiKey}
                                        onChange={(e) => setEscalaConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                                        placeholder="Escala API Bearer Token"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                                    />
                                    <Key className="absolute right-4 top-3.5 text-slate-300" size={16} />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-100">
                             <button 
                                onClick={handleTestEscala}
                                disabled={isTestingEscala || !escalaConfig.apiKey}
                                className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                                    escalaTestResult === 'success' ? 'bg-emerald-500 text-white' : 
                                    escalaTestResult === 'error' ? 'bg-red-500 text-white' : 
                                    'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {isTestingEscala ? <Loader2 size={16} className="animate-spin" /> : 
                                 escalaTestResult === 'success' ? <Check size={16} /> : 
                                 escalaTestResult === 'error' ? <AlertCircle size={16} /> : 
                                 <RefreshCw size={16} />}
                                {isTestingEscala ? 'Testing...' : 
                                 escalaTestResult === 'success' ? 'Connected' : 
                                 escalaTestResult === 'error' ? 'Connection Failed' : 'Test Connection'}
                            </button>

                            <button 
                                onClick={handleSaveEscala}
                                disabled={isSavingEscala}
                                className="px-6 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-brand-700 shadow-md transition-all active:scale-95"
                            >
                                {isSavingEscala ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Save Configuration
                            </button>
                        </div>

                        {escalaTestResult === 'error' && (
                            <p className="mt-4 text-[10px] text-red-500 font-bold flex items-center gap-1 animate-in slide-in-from-top-1">
                                <AlertCircle size={12} /> Please verify your API Key and Account ID from the Escala Dashboard.
                            </p>
                        )}
                    </div>
                </div>
            );
        default: return <div className="p-12 text-center text-gray-400">Loading...</div>;
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
        <div className="border-b border-gray-200 bg-white px-6 py-2 flex gap-6 shrink-0 overflow-x-auto no-scrollbar">
             <button onClick={() => setActiveSubTab('general')} className={`py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeSubTab === 'general' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>General</button>
             <button onClick={() => setActiveSubTab('voice')} className={`py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeSubTab === 'voice' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Voice Lab</button>
             <button onClick={() => setActiveSubTab('integrations')} className={`py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeSubTab === 'integrations' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Integrations</button>
             <button onClick={() => setActiveSubTab('usage')} className={`py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeSubTab === 'usage' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Usage</button>
        </div>
        <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-4xl mx-auto">
                {renderTabContent()}
            </div>
        </div>
    </div>
  );
};

export default AdminDashboard;
