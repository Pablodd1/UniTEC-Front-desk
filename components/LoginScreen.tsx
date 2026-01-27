
import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, Lock, FastForward } from 'lucide-react';
import { BusinessConfig } from '../types';

interface LoginScreenProps {
  config: BusinessConfig;
  onLogin: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ config, onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin' || password === '1234') {
      onLogin();
    } else {
      setError('Invalid PIN');
    }
  };

  return (
    <div className="h-full w-full bg-slate-50 flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
        <div className="w-full bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
            <div className="flex flex-col items-center text-center mb-8">
                <div className="w-14 h-14 bg-brand-900 rounded-2xl flex items-center justify-center text-accent-500 mb-4 shadow-lg">
                    <ShieldCheck size={32} />
                </div>
                <h2 className="text-lg font-bold text-slate-800">Admin Secure Access</h2>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Management Controls Required</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Access PIN</label>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoFocus
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xl tracking-[0.5em] font-black focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                        placeholder="••••"
                    />
                </div>
                
                {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-[10px] font-bold uppercase text-center rounded-xl flex items-center justify-center gap-2">
                        <Lock size={12} /> {error}
                    </div>
                )}

                <button 
                    type="submit"
                    className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition-all active:scale-[0.98]"
                >
                    Unlock System <ArrowRight size={18} />
                </button>
                
                <button 
                    type="button"
                    onClick={onLogin}
                    className="w-full text-slate-400 font-bold py-2 text-[10px] uppercase tracking-widest hover:text-brand-600 transition-all flex items-center justify-center gap-2"
                >
                    <FastForward size={14} /> Quick Bypass (Dev)
                </button>
            </form>
        </div>
        <p className="mt-8 text-[9px] text-slate-400 font-bold uppercase tracking-tighter">© UNITEC USA DESIGN • SECURE GATEWAY</p>
    </div>
  );
};

export default LoginScreen;
