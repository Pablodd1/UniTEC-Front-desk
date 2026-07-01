// @ts-nocheck\nï»¿import React from 'react';
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
    <div className="h-full flex-1 min-h-0 flex flex-col bg-slate-50 font-sans selection:bg-brand-500/30 overflow-hidden">
      {/* Sticky Navbar */}
      

      {/* Main Content Area: Split Screen */}
      <main className="flex-1 min-h-0 flex flex-col w-full bg-slate-50 relative z-10">
        
        {/* Right Side: Interactive App Area (Chat/Admin/Etc) */}
        <div className="w-full relative bg-slate-50 flex flex-col flex-1 min-h-0">
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
                {language === 'en' ? 'Chat Assistant' : 'Asistente de Chat'}
              </button>
              <button
                onClick={() => onTabChange(Tab.CALL)}
                className={`flex-1 py-3.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${
                  activeTab === Tab.CALL
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {language === 'en' ? 'Voice Call (AI)' : 'Llamada de Voz (IA)'}
              </button>
            </div>
          )}
          <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
            {children}
          </div>
        </div>

      </main>
      
      {/* Footer */}
      
    </div>
  );
};

export default WebsiteLayout;









