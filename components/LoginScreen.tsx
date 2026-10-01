import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowRight, Lock, Loader2, Mail } from 'lucide-react';
import { BusinessConfig } from '../types';
import { auth } from '../firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

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
      // SECURITY: only REAL (non-anonymous) sessions may skip the credentials form.
      // The app creates an anonymous session for every visitor (Firestore access),
      // so treating any user as logged-in would auto-open the admin panel for anyone.
      if (user && !user.isAnonymous) {
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
      signInAnonymously(auth).then(() => {
        setIsLoading(false);
        onLogin();
      }).catch(err => {
        console.error(err);
        setIsLoading(false);
        onLogin();
      });
    } else {
      setTimeout(() => {
        setError('Correo o contraseña inválidos.');
        setIsLoading(false);
      }, 600);
    }
  };

  
  return (
    <div className="h-full w-full bg-slate-50 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="w-full max-w-sm bg-white p-8 rounded-[36px] shadow-xl border border-slate-200 text-left">
            <div className="flex flex-col items-center text-center mb-6">
                <div className="w-14 h-14 bg-brand-900 rounded-3xl flex items-center justify-center text-accent-500 mb-3 shadow-lg">
                    <ShieldCheck size={30} />
                </div>
                <h2 className="text-base font-black text-slate-800 tracking-tight">Acceso Administrador</h2>
                <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Credenciales Requeridas</p>
            </div>

            {error && (
                <div className="p-3 mb-4 bg-red-50 text-red-600 text-[10px] font-bold uppercase text-center rounded-xl flex items-center justify-center gap-2 border border-red-100">
                    <Lock size={12} /> {error}
                </div>
            )}

            <form onSubmit={handleCredentialLogin} className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Correo Electrónico</label>
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
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Contraseña</label>
                    <div className="relative">
                        <Lock className="absolute left-3.5 top-3.5 text-slate-400" size={14} />
                        <input 
                            type="password" 
                            required
                            placeholder="Ingresa tu contraseña"
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
                    {isLoading ? 'Verificando...' : 'Acceder al Panel'}
                </button>
            </form>

            
        </div>
        <p className="mt-6 text-[8px] text-slate-400 font-black uppercase tracking-widest text-center">© UNITEC USA DESIGN • SECURE GATEWAY</p>
    </div>
  );
};

export default LoginScreen;

