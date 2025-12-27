import React from 'react';
import { Tab, BusinessConfig, Language } from '../types';
import { MessageSquare, Phone, Grid, Info, ShieldCheck, Settings, Calendar, LogOut, LayoutDashboard } from 'lucide-react';
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
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, config, onOpenDashboard, language, setLanguage, onLogout }) => {
  const t = UI_TRANSLATIONS[language];

  const MenuItem = ({ tab, icon, label, onClick }: { tab?: Tab, icon: React.ReactNode, label: string, onClick?: () => void }) => {
    const isActive = tab === activeTab;
    return (
        <button
            onClick={onClick || (() => tab && onTabChange(tab))}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/30' 
                : 'text-brand-100 hover:bg-brand-800 hover:text-white'
            }`}
        >
            <div className={`${isActive ? 'text-white' : 'text-brand-300 group-hover:text-white'}`}>
                {icon}
            </div>
            <span className="font-medium text-sm">{label}</span>
        </button>
    );
  };

  return (
    <div className="flex h-full w-full bg-slate-100">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-brand-900 flex flex-col shrink-0 h-full border-r border-brand-800">
        {/* Brand Header */}
        <div className="p-6 border-b border-brand-800">
            <div className="flex items-center gap-3 mb-2">
                <ShieldCheck size={28} className="text-accent-500" />
                <h1 className="font-bold text-white text-lg tracking-wide leading-none">UNITEC <br/><span className="text-brand-300 font-light">DESIGN</span></h1>
            </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
            <div className="text-xs font-bold text-brand-400 uppercase tracking-widest px-4 mb-2">Communication</div>
            <MenuItem tab={Tab.CHAT} icon={<MessageSquare size={20} />} label={t.navChat} />
            <MenuItem tab={Tab.CALL} icon={<Phone size={20} />} label={t.navCall} />
            
            <div className="text-xs font-bold text-brand-400 uppercase tracking-widest px-4 mb-2 mt-6">Operations</div>
            <MenuItem tab={Tab.CALENDAR} icon={<Calendar size={20} />} label="Calendar & Email" />
            <MenuItem tab={Tab.SERVICES} icon={<Grid size={20} />} label={t.navServices} />
            
            <div className="text-xs font-bold text-brand-400 uppercase tracking-widest px-4 mb-2 mt-6">System</div>
            <MenuItem tab={Tab.ADMIN_SETTINGS} icon={<LayoutDashboard size={20} />} label="Admin Dashboard" />
            <MenuItem tab={Tab.INFO} icon={<Info size={20} />} label={t.navInfo} />
        </div>

        {/* User / Footer */}
        <div className="p-4 border-t border-brand-800 bg-brand-950/30">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent-500 flex items-center justify-center text-brand-900 font-bold text-xs">
                        AD
                    </div>
                    <div>
                        <p className="text-white text-sm font-medium">Admin User</p>
                        <p className="text-brand-400 text-xs">Online</p>
                    </div>
                </div>
                <button onClick={onLogout} className="text-brand-400 hover:text-white transition-colors" title="Logout">
                    <LogOut size={18} />
                </button>
            </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
            <h2 className="text-xl font-bold text-slate-800">
                {activeTab === Tab.CHAT && t.navChat}
                {activeTab === Tab.CALL && t.navCall}
                {activeTab === Tab.SERVICES && t.navServices}
                {activeTab === Tab.INFO && t.navInfo}
                {activeTab === Tab.CALENDAR && "Calendar & Email"}
                {activeTab === Tab.ADMIN_SETTINGS && "Admin Dashboard"}
            </h2>

            <div className="flex items-center gap-4">
                 {/* Language Toggle */}
                 <button
                    onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
                    className="flex items-center bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5 transition-colors border border-gray-200"
                >
                    <span className={`text-xs font-bold ${language === 'en' ? 'text-brand-600' : 'text-gray-400'}`}>EN</span>
                    <span className="text-gray-300 mx-2">|</span>
                    <span className={`text-xs font-bold ${language === 'es' ? 'text-brand-600' : 'text-gray-400'}`}>ES</span>
                </button>
            </div>
        </header>

        {/* Content Viewport */}
        <div className="flex-1 overflow-hidden bg-slate-50 relative">
            <div className="absolute inset-0 overflow-y-auto">
                 {/* Container constraint only for specific tabs to maintain readability */}
                 <div className={`h-full mx-auto ${activeTab === Tab.CHAT || activeTab === Tab.CALL ? 'max-w-4xl bg-white shadow-sm border-x border-gray-100' : 'w-full'}`}>
                    {children}
                 </div>
            </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
