
import React from 'react';
import { Tab, BusinessConfig, Language, CartItem } from '../types';
import { MessageSquare, Phone, ShieldCheck, LayoutDashboard, ChevronDown, ShoppingCart } from 'lucide-react';
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
  cart?: CartItem[];
  onOpenCart?: () => void;
  showAdminTab?: boolean;
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
  cart = [],
  onOpenCart,
  onToggleBrand,
  showAdminTab
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
      <header className={`${currentBrandId === 'building' ? 'bg-[#075e54]' : 'bg-brand-900'} p-4 shrink-0 relative overflow-hidden ${isEmbedMode ? '' : ''}`}>
        <div className="absolute top-0 left-0 w-full h-full opacity-10 grass-texture pointer-events-none"></div>
        <div className="flex flex-col gap-3 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20 overflow-hidden shrink-0">
                  {currentBrandId === 'building' ? (
                    <svg className="w-6 h-6 fill-white text-white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.488 1.459 5.407 1.461 5.432.001 9.851-4.417 9.854-9.853.001-2.63-1.023-5.102-2.883-6.964C17.16 1.836 14.68 1.819 12.01 1.819c-5.437 0-9.857 4.417-9.86 9.854-.001 1.895.5 3.734 1.452 5.347l-.995 3.635 3.737-.98l-.297-.182zm10.744-6.309c-.297-.149-1.758-.868-2.031-.967-.272-.099-.471-.148-.669.149-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    </svg>
                  ) : (
                    <ShieldCheck className="text-accent-500" size={24} />
                  )}
               </div>
               <div>
                 <h1 className="text-white text-sm font-black tracking-wider uppercase leading-none">
                   {firstName} <span className="text-brand-300 font-light">{restName}</span>
                 </h1>
                 <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[9px] text-brand-300 font-bold uppercase tracking-widest">
                      {currentBrandId === 'building' ? 'Online / En Línea' : t.stockActive}
                    </span>
                 </div>
               </div>
            </div>
                        <div className="flex items-center gap-2">
              {onOpenCart && (
                <button 
                  onClick={onOpenCart}
                  className="relative p-2 text-white/80 hover:text-white transition-colors"
                >
                  <ShoppingCart size={20} />
                  {cart && cart.length > 0 && (
                    <span className="absolute top-0 right-0 h-4 w-4 bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border border-brand-900">
                      {cart.reduce((total, item) => total + item.quantity, 0)}
                    </span>
                  )}
                </button>
              )}
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

      {/* Bottom Navigation - Admin tab hidden in embed mode; lives at standalone domain */}
      <nav className="h-20 bg-white border-t border-slate-100 flex items-center justify-around px-2 shrink-0 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
          <NavItem tab={Tab.CHAT} icon={<MessageSquare />} label={t.navChat} />
          <NavItem tab={Tab.CALL} icon={<Phone />} label={t.navCall} />
          <NavItem tab={Tab.PRIVACY} icon={<ShieldCheck />} label={language === 'en' ? 'Privacy' : 'Privacidad'} />
          {showAdminTab && <NavItem tab={Tab.ADMIN_SETTINGS} icon={<LayoutDashboard />} label="Admin" />}
      </nav>
    </div>
  );
};

export default Layout;








