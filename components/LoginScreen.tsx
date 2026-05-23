import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowRight, Lock, Loader2, Mail } from 'lucide-react';
import { BusinessConfig } from '../types';
import { signInWithGoogle, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface LoginScreenProps {
  config: BusinessConfig;
  onLogin: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        onLogin();
      }
    });
    return () => unsubscribe();
  }, [onLogin]);

  const handleCredentialLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Normalize email & verify credentials
    if (email.trim().toLowerCase() === 'admin@unitecdesign.com' && password === 'UnitecAdmin2026!') {
      sessionStorage.setItem('unitec_local_admin', 'true');
      setTimeout(() => {
        setIsLoading(false);
        onLogin();
      }, 800);
    } else {
      setTimeout(() => {
        setError('Invalid Email or Password credentials.');
        setIsLoading(false);
      }, 600);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-slate-50 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="w-full max-w-sm bg-white p-8 rounded-[36px] shadow-xl border border-slate-200 text-left">
            <div className="flex flex-col items-center text-center mb-6">
                <div className="w-14 h-14 bg-brand-900 rounded-3xl flex items-center justify-center text-accent-500 mb-3 shadow-lg">
                    <ShieldCheck size={30} />
                </div>
                <h2 className="text-base font-black text-slate-800 tracking-tight">Admin Gatekeeper</h2>
                <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Secure Credentials Required</p>
            </div>

            {error && (
                <div className="p-3 mb-4 bg-red-50 text-red-600 text-[10px] font-bold uppercase text-center rounded-xl flex items-center justify-center gap-2 border border-red-100">
                    <Lock size={12} /> {error}
                </div>
            )}

            <form onSubmit={handleCredentialLogin} className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Email Address</label>
                    <div className="relative">
                        <Mail className="absolute left-3.5 top-3.5 text-slate-400" size={14} />
                        <input 
                            type="email" 
                            required
                            placeholder="admin@unitecdesign.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-300 text-slate-800"
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Secure Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3.5 top-3.5 text-slate-400" size={14} />
                        <input 
                            type="password" 
                            required
                            placeholder="Enter password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-300 text-slate-800"
                        />
                    </div>
                </div>

                <button 
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-brand-500/10 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                    {isLoading ? 'Verifying...' : 'Access Dashboard'}
                </button>
            </form>

            <div className="relative my-6 flex items-center justify-center text-center">
                <div className="absolute inset-x-0 h-px bg-slate-100"></div>
                <span className="relative px-3 bg-white text-[9px] font-bold text-slate-400 uppercase">Or</span>
            </div>

            <button 
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl flex items-center justify-center gap-2 text-xs transition-all disabled:opacity-50"
            >
                Google Authentication
            </button>
        </div>
        <p className="mt-6 text-[8px] text-slate-400 font-black uppercase tracking-widest text-center">© UNITEC USA DESIGN • SECURE GATEWAY</p>
    </div>
  );
};

export default LoginScreen;
