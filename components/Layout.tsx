import React from 'react';
import { Tab, BusinessConfig, Language } from '../types';
import { MessageSquare, Phone, Grid, Info, ShieldCheck, Settings } from 'lucide-react';
import { UI_TRANSLATIONS } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  config: BusinessConfig;
  onOpenDashboard: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, config, onOpenDashboard, language, setLanguage }) => {
  const t = UI_TRANSLATIONS[language];

  return (
    <div className="flex flex-col h-full max-w-md mx-auto bg-white shadow-2xl overflow-hidden border-x border-gray-200">
      {/* Header */}
      <header className="bg-gradient-to-r from-brand-900 to-brand-800 text-white p-4 shrink-0 relative z-10">
        <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
                <div className="bg-white/10 p-2 rounded-lg">
                    <ShieldCheck size={24} className="text-accent-500" />
                </div>
                <div>
                    <h1 className="font-bold text-lg leading-tight tracking-wide">{config.name}</h1>
                    <p className="text-xs text-brand-100 font-light tracking-wider">{config.tagline.toUpperCase()}</p>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                {/* Language Toggle */}
                <button
                    onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
                    className="flex items-center bg-black/20 hover:bg-black/30 rounded-lg px-2 py-1 transition-colors"
                    title="Toggle Language"
                >
                    <span className={`text-xs font-bold ${language === 'en' ? 'text-white' : 'text-gray-400'}`}>EN</span>
                    <span className="text-gray-400 mx-1">|</span>
                    <span className={`text-xs font-bold ${language === 'es' ? 'text-white' : 'text-gray-400'}`}>ES</span>
                </button>

                <button 
                onClick={onOpenDashboard}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                aria-label="Open Admin Dashboard"
                >
                <Settings size={20} className="text-brand-100" />
                </button>
            </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative bg-brand-50/50">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-gray-200 shrink-0 safe-area-bottom">
        <div className="flex justify-around items-center h-16">
          <NavButton 
            active={activeTab === Tab.CHAT} 
            onClick={() => onTabChange(Tab.CHAT)} 
            icon={<MessageSquare size={20} />} 
            label={t.navChat} 
          />
          <NavButton 
            active={activeTab === Tab.CALL} 
            onClick={() => onTabChange(Tab.CALL)} 
            icon={<Phone size={20} />} 
            label={t.navCall} 
          />
          <NavButton 
            active={activeTab === Tab.SERVICES} 
            onClick={() => onTabChange(Tab.SERVICES)} 
            icon={<Grid size={20} />} 
            label={t.navServices} 
          />
          <NavButton 
            active={activeTab === Tab.INFO} 
            onClick={() => onTabChange(Tab.INFO)} 
            icon={<Info size={20} />} 
            label={t.navInfo} 
          />
        </div>
      </nav>
    </div>
  );
};

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${
      active ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'
    }`}
  >
    <div className={`mb-1 transition-transform duration-200 ${active ? 'scale-110' : ''}`}>
      {icon}
    </div>
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

export default Layout;