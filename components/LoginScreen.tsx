import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, Lock, Activity, FastForward } from 'lucide-react';
import { BusinessConfig } from '../types';

interface LoginScreenProps {
  config: BusinessConfig;
  onLogin: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ config, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin' || password === '1234') {
      onLogin();
    } else {
      setError('Invalid credentials. Try "admin"');
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-900 overflow-hidden">
      {/* Left Side - Landing Visuals */}
      <div className="hidden lg:flex flex-1 relative bg-brand-900 flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900/90 to-slate-900/80"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 text-white mb-8">
            <ShieldCheck size={32} className="text-accent-500" />
            <h1 className="text-2xl font-bold tracking-wider">{config.name}</h1>
          </div>
          <h2 className="text-5xl font-extrabold text-white leading-tight mb-6">
            The Future of <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-accent-500">
              Wholesale Distribution
            </span>
          </h2>
          <p className="text-brand-100 text-lg max-w-lg">
            AI-powered receptionist, automated CRM logging, and real-time voice synthesis. Streamline your operations with UNITEC Design.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-6 mt-12">
            <div className="bg-white/5 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                <Activity className="text-accent-500 mb-2" />
                <h3 className="text-white font-bold">99.9% Uptime</h3>
                <p className="text-brand-200 text-sm">Enterprise grade reliability</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                <ShieldCheck className="text-brand-400 mb-2" />
                <h3 className="text-white font-bold">Secure Data</h3>
                <p className="text-brand-200 text-sm">256-bit AES Encryption</p>
            </div>
        </div>

        <div className="relative z-10 text-brand-200 text-sm">
          © 2024 UNITEC USA DESIGN. All rights reserved.
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
            <div className="lg:hidden flex items-center gap-2 text-brand-900 mb-8 justify-center">
                <ShieldCheck size={28} className="text-accent-500" />
                <h1 className="text-xl font-bold tracking-wider">{config.name}</h1>
            </div>

            <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-800">Welcome Back</h2>
                <p className="text-slate-500">Please enter your details to sign in.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                        placeholder="admin@unitec.com"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                        placeholder="••••••••"
                    />
                </div>
                
                {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                        <Lock size={16} /> {error}
                    </div>
                )}

                <div className="flex flex-col gap-3">
                  <button 
                      type="submit"
                      className="btn-grass w-full text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg"
                  >
                      Sign In <ArrowRight size={18} />
                  </button>
                  
                  <button 
                      type="button"
                      onClick={onLogin}
                      className="w-full bg-white text-slate-500 border border-slate-200 font-medium py-2 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                      <FastForward size={16} /> Skip Login (Dev Mode)
                  </button>
                </div>
            </form>

            <div className="mt-6 text-center text-sm text-slate-400">
                <p>Default Password: <span className="font-mono text-brand-600">admin</span></p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;