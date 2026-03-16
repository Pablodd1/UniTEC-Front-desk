
import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowRight, Lock, Loader2 } from 'lucide-react';
import { BusinessConfig } from '../types';
import { signInWithGoogle, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface LoginScreenProps {
  config: BusinessConfig;
  onLogin: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
      setIsLoading(false);
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
                {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-[10px] font-bold uppercase text-center rounded-xl flex items-center justify-center gap-2">
                        <Lock size={12} /> {error}
                    </div>
                )}

                <button 
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                    {isLoading ? 'Authenticating...' : 'Sign in with Google'}
                </button>
            </form>
        </div>
        <p className="mt-8 text-[9px] text-slate-400 font-bold uppercase tracking-tighter">© UNITEC USA DESIGN • SECURE GATEWAY</p>
    </div>
  );
};

export default LoginScreen;
