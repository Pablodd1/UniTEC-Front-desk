
import React from 'react';
import { Tab, BusinessConfig, Language } from '../types';
import { MessageSquare, Phone, ShieldCheck, LayoutDashboard, ChevronDown } from 'lucide-react';
import { UI_TRANSLATIONS } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  config: BusinessConfig;
  onOpenDashboard: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  onLogout: () => void;
  onCloseWidget: () => void;
  isEmbedMode?: boolean;
  currentBrandId?: 'unitec' | 'building';
  onToggleBrand?: (brand: 'unitec' | 'building') => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  onTabChange, 
  config, 
  language, 
  onCloseWidget, 
  isEmbedMode,
  currentBrandId,
  onToggleBrand
}) => {
  const t = UI_TRANSLATIONS[language];

  const NavItem = ({ tab, icon, label }: { tab: Tab, icon: React.ReactNode, label: string }) => {
    const isActive = tab === activeTab;
    return (
      <button
        onClick={() => onTabChange(tab)}
        className={`flex flex-col items-center justify-center flex-1 py-2 transition-all duration-300 ${
          isActive ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-brand-50' : ''}`}>
          {React.cloneElement(icon as React.ReactElement<any>, { size: 20 })}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-tight mt-1">{label}</span>
      </button>
    );
  };

  const nameParts = config.name.split(' ');
  const firstName = nameParts[0];
  const restName = nameParts.slice(1).join(' ');

  // Full page mode (when visiting directly) - NO popup, full screen
  const layoutClasses = isEmbedMode 
    ? "h-full w-full flex flex-col bg-white overflow-hidden" 
    : "h-screen w-screen flex flex-col bg-white overflow-hidden";

  return (
    <div className={layoutClasses}>
      
      {/* Widget Header */}
      <header className={`bg-brand-900 p-4 shrink-0 relative overflow-hidden ${isEmbedMode ? '' : ''}`}>
        <div className="absolute top-0 left-0 w-full h-full opacity-10 grass-texture pointer-events-none"></div>
        <div className="flex flex-col gap-3 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
                  <ShieldCheck className="text-accent-500" size={24} />
               </div>
               <div>
                 <h1 className="text-white text-sm font-black tracking-wider uppercase leading-none">
                   {firstName} <span className="text-brand-300 font-light">{restName}</span>
                 </h1>
                 <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[9px] text-brand-300 font-bold uppercase tracking-widest">{t.stockActive}</span>
                 </div>
               </div>
            </div>
            <div className="flex items-center gap-2">
              {!isEmbedMode && (
                  <button 
                  onClick={onCloseWidget}
                  className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all"
                  >
                  <ChevronDown size={24} />
                  </button>
              )}
            </div>
          </div>

          {/* Quick Responsive Brand Switcher */}
          {onToggleBrand && currentBrandId && (
            <div className="flex bg-white/10 p-0.5 rounded-xl border border-white/[0.08]">
              <button 
                onClick={() => onToggleBrand('unitec')}
                className={`flex-1 py-1 px-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all duration-300 ${
                  currentBrandId === 'unitec' ? 'bg-white text-brand-950 shadow-sm' : 'text-white/75 hover:text-white'
                }`}
              >
                Unitec USA
              </button>
              <button 
                onClick={() => onToggleBrand('building')}
                className={`flex-1 py-1 px-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all duration-300 ${
                  currentBrandId === 'building' ? 'bg-white text-brand-950 shadow-sm' : 'text-white/75 hover:text-white'
                }`}
              >
                Building Innovation
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Content Viewport */}
      <main className="flex-1 overflow-hidden relative bg-slate-50">
          <div className="absolute inset-0 overflow-y-auto no-scrollbar pb-safe">
             {children}
          </div>
      </main>

      {/* Bottom Navigation */}
      <nav className={`h-20 bg-white border-t border-slate-100 flex items-center justify-around px-2 shrink-0 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.03)] ${isEmbedMode ? '' : ''}`}>
          <NavItem tab={Tab.CHAT} icon={<MessageSquare />} label={t.navChat} />
          <NavItem tab={Tab.CALL} icon={<Phone />} label={t.navCall} />
          <NavItem tab={Tab.ADMIN_SETTINGS} icon={<LayoutDashboard />} label="Admin" />
      </nav>
    </div>
  );
};

export default Layout;
