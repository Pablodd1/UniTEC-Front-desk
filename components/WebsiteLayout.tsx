import React from 'react';
import { BusinessConfig, CartItem, Language, Tab } from '../types';
import { Facebook, Instagram, Linkedin, Settings, ShoppingBag } from 'lucide-react';
import { motion } from 'framer-motion';

interface WebsiteLayoutProps {
  children: React.ReactNode;
  config: BusinessConfig;

  language: Language;
  setLanguage: (lang: Language) => void;
  isEmbedMode: boolean;
  currentBrandId: 'unitec' | 'building';
  onToggleBrand?: (brand: 'unitec' | 'building') => void;
  cart: CartItem[];
  onOpenCart: () => void;
  onOpenDashboard: () => void;
  onLogout?: () => void;
  onCloseWidget: () => void;
  showAdminTab: boolean;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const WebsiteLayout: React.FC<WebsiteLayoutProps> = ({
  children,
  config,
  language,
  setLanguage,
  currentBrandId,
  onToggleBrand,
  cart,
  onOpenCart,
  showAdminTab,
  onOpenDashboard,
  activeTab,
  onTabChange
}) => {
  const isUnitec = currentBrandId === 'unitec';
  const themeColor = isUnitec ? 'bg-sky-900' : 'bg-emerald-900';
  const textColor = isUnitec ? 'text-sky-900' : 'text-emerald-900';


  const cartItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans selection:bg-brand-500/30">
      {/* Sticky Navbar */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/90 border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo / Brand Name */}
            <div className="flex items-center gap-4">
              <div className={"w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-current/20 " + themeColor}>
                {isUnitec ? 'U' : 'B'}
              </div>
              <div>
                <h1 className={"font-black text-xl tracking-tight " + textColor}>{config.name}</h1>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{config.tagline.split('/')[0]}</p>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-8">
              {config.navLinks?.map((link, idx) => (
                <a key={idx} href={link.href} className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors uppercase tracking-wider">
                  {link.label}
                </a>
              ))}
              
              {/* Language & Cart */}
              <div className="flex items-center gap-4 ml-4 border-l border-slate-200 pl-4">
                <button
                  onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
                  className="px-3 py-1.5 rounded-full bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors uppercase"
                >
                  {language === 'en' ? 'ES' : 'EN'}
                </button>
                <button 
                  onClick={onOpenCart}
                  className="relative p-2 text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <ShoppingBag size={20} />
                  {cartItemsCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white">
                      {cartItemsCount}
                    </span>
                  )}
                </button>
                {showAdminTab && (
                  <button 
                    onClick={onOpenDashboard}
                    className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
                    title="Admin Dashboard"
                  >
                    <Settings size={20} />
                  </button>
                )}
                {onToggleBrand && (
                  <button
                    onClick={() => onToggleBrand(isUnitec ? 'building' : 'unitec')}
                    className="ml-2 px-4 py-2 rounded-xl border-2 border-slate-200 text-xs font-bold text-slate-600 hover:border-slate-300 transition-colors"
                  >
                    Switch to {isUnitec ? 'Building' : 'Unitec'}
                  </button>
                )}
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area: Split Screen */}
      <main className="flex-1 flex flex-col lg:flex-row w-full max-w-[1600px] mx-auto bg-white shadow-2xl xl:my-8 xl:rounded-3xl overflow-hidden border border-slate-200/60 relative z-10">
        
        {/* Left Side: Marketing & Hero */}
        <div className="w-full lg:w-5/12 xl:w-1/2 relative flex flex-col justify-between bg-slate-900 text-white overflow-hidden shrink-0">
          {/* Background Image with Overlay */}
          <div className="absolute inset-0 z-0">
            <img 
              src={config.heroImage || "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80"} 
              alt="Background" 
              className="w-full h-full object-cover opacity-40 mix-blend-overlay"
            />
            <div className={"absolute inset-0 opacity-80 bg-gradient-to-br " + (isUnitec ? 'from-sky-950 via-slate-900 to-black' : 'from-emerald-950 via-slate-900 to-black')} />
          </div>

          <div className="relative z-10 p-8 lg:p-12 xl:p-16 flex flex-col h-full justify-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-8">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/90">
                  {language === 'en' ? 'Live Virtual Assistant' : 'Asistente Virtual En Línea'}
                </span>
              </div>
              
              <h2 className="text-5xl xl:text-6xl font-black tracking-tight leading-[1.1] mb-6">
                {config.heroTitle}
              </h2>
              <p className="text-lg xl:text-xl text-slate-300 font-medium leading-relaxed max-w-lg mb-10">
                {config.heroSubtitle}
              </p>

              <div className="flex items-center gap-4">
                {config.socialLinks?.facebook && (
                  <a href={config.socialLinks.facebook} target="_blank" rel="noreferrer" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 hover:-translate-y-1 transition-all">
                    <Facebook size={20} />
                  </a>
                )}
                {config.socialLinks?.instagram && (
                  <a href={config.socialLinks.instagram} target="_blank" rel="noreferrer" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 hover:-translate-y-1 transition-all">
                    <Instagram size={20} />
                  </a>
                )}
                {config.socialLinks?.linkedin && (
                  <a href={config.socialLinks.linkedin} target="_blank" rel="noreferrer" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 hover:-translate-y-1 transition-all">
                    <Linkedin size={20} />
                  </a>
                )}
              </div>
            </motion.div>
          </div>
          
          <div className="relative z-10 p-8 lg:p-12 border-t border-white/10 backdrop-blur-md bg-black/20">
            <p className="text-sm text-slate-400">
              <strong className="text-white">Contact:</strong> {config.contact.whatsapp} <br/>
              {config.contact.location}
            </p>
          </div>
        </div>

        {/* Right Side: Interactive App Area (Chat/Admin/Etc) */}
        <div className="w-full lg:w-7/12 xl:w-1/2 h-[800px] lg:h-auto min-h-[600px] relative bg-slate-50 flex flex-col">
          {/* Tab Switcher for Chat/Voice Call (Only when not in admin/privacy/calendar tabs) */}
          {(activeTab === Tab.CHAT || activeTab === Tab.CALL) && (
            <div className="flex border-b border-slate-200 bg-white shrink-0 p-1.5 gap-1.5">
              <button
                onClick={() => onTabChange(Tab.CHAT)}
                className={`flex-1 py-3.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${
                  activeTab === Tab.CHAT
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                💬 {language === 'en' ? 'Chat Assistant' : 'Asistente de Chat'}
              </button>
              <button
                onClick={() => onTabChange(Tab.CALL)}
                className={`flex-1 py-3.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${
                  activeTab === Tab.CALL
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                🎤 {language === 'en' ? 'Voice Call (AI)' : 'Llamada de Voz (IA)'}
              </button>
            </div>
          )}
          <div className="flex-1 flex flex-col relative overflow-hidden">
            {children}
          </div>
        </div>

      </main>
      
      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 text-center text-xs mt-auto">
        <p>&copy; {new Date().getFullYear()} {config.name}. {language === 'en' ? 'All rights reserved.' : 'Todos los derechos reservados.'}</p>
      </footer>
    </div>
  );
};

export default WebsiteLayout;








