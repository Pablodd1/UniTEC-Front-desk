import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import WebsiteLayout from './components/WebsiteLayout';
import ChatTab from './components/ChatTab';
import CallTab from './components/CallTab';
import AdminDashboard from './components/AdminDashboard';
import CalendarTab from './components/CalendarTab';
import LoginScreen from './components/LoginScreen';
import ServicesTab from './components/ServicesTab';
import InfoTab from './components/InfoTab';
import PrivacyTab from './components/PrivacyTab';
import CartSidebar from './components/CartSidebar';
import { Tab, Language, VoiceName, VoiceProvider, CartItem } from './types';
import { UNITEC_CONFIG, BUILDING_INNOVATION_CONFIG, QUICK_ACTIONS } from './constants';
import { resetChatSession } from './services/geminiService';
import { auth, logOut } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

const App: React.FC = () => {
  const isEmbedMode = new URLSearchParams(window.location.search).get('embed') === 'true';

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>(Tab.CHAT);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [language, setLanguage] = useState<Language>('es');
  const [showAdminTab, setShowAdminTab] = useState(false);
  
  const [currentBrandId, setCurrentBrandId] = useState<'unitec' | 'building'>(() => {
    const brand = new URLSearchParams(window.location.search).get('brandId');
    if (brand === 'building' || brand === 'unitec') return brand;
    if (window.location.hostname.includes('buildinginnovation')) return 'building';
    return 'unitec';
  });
  const activeConfig = currentBrandId === 'unitec' ? UNITEC_CONFIG : BUILDING_INNOVATION_CONFIG;

  const [bgImage, setBgImage] = useState<string>(localStorage.getItem('unitec_custom_bg') || "https://images.unsplash.com/photo-1494412519320-aa613dfb7738?auto=format&fit=crop&q=80&w=1920");

  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>('gemini');
  const [voiceName, setVoiceName] = useState<VoiceName>('Kore');
  
  const [initialMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    resetChatSession();
  }, [emergencyMode, language, currentBrandId]);

  useEffect(() => {
    const checkAdminMode = () => {
      const hash = window.location.hash;
      const search = window.location.search;
      const hasAdminParam = search.includes('admin=true') || hash === '#admin';
      const hasStoredAdmin = localStorage.getItem('unitec_show_admin') === 'true';
      
      if (hasAdminParam || hasStoredAdmin) {
        setShowAdminTab(true);
        if (hasAdminParam) {
          localStorage.setItem('unitec_show_admin', 'true');
        }
        if (hash === '#admin') {
          setActiveTab(Tab.ADMIN_SETTINGS);
        }
      }
    };
    
    checkAdminMode();
    window.addEventListener('hashchange', checkAdminMode);
    return () => window.removeEventListener('hashchange', checkAdminMode);
  }, []);

  useEffect(() => {
    const isUnitec = currentBrandId === 'unitec';
    document.documentElement.lang = 'es';
    document.title = isUnitec
      ? 'UNITEC USA Design | Recepcionista Virtual IA | Distribuci�n Mayorista'
      : 'Building Innovation | Asistente Virtual IA | Miami, Florida';

    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = isUnitec
      ? 'Recepcionista virtual IA para distribuci�n mayorista de materiales de construcci�n. Consulta cat�logo, stock en Florida y cotizaciones al instante.'
      : 'Asistente virtual IA de Building Innovation. Consulta productos, stock en Miami y conecta con ventas. Atenci�n inmediata 24/7.';

    const setOg = (property: string, val: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el); }
      el.content = val;
    };
    setOg('og:title', isUnitec ? 'UNITEC USA Design | Asistente Virtual IA' : 'Building Innovation | Asistente Virtual IA');
    setOg('og:description', isUnitec
      ? 'Consulta cat�logo, stock y cotizaciones en tiempo real. Distribuidor mayorista de materiales de construcci�n premium.'
      : 'Paneles WPC, pisos SPC, fachadas y m�s. Consulta disponibilidad y cotiza ahora mismo.');
    setOg('og:locale', 'es_ES');

    const unitecSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0c4a6e"/><text x="32" y="46" font-family="Arial,sans-serif" font-weight="900" font-size="38" fill="white" text-anchor="middle">U</text></svg>';
    const buildingSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#065f46"/><text x="32" y="46" font-family="Arial,sans-serif" font-weight="900" font-size="38" fill="white" text-anchor="middle">B</text></svg>';
    const svgContent = isUnitec ? unitecSvg : buildingSvg;
    const encoded = `data:image/svg+xml,${encodeURIComponent(svgContent)}`;

    let faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!faviconLink) {
      faviconLink = document.createElement('link');
      faviconLink.rel = 'icon';
      document.head.appendChild(faviconLink);
    }
    faviconLink.type = 'image/svg+xml';
    faviconLink.href = encoded;

    let shortcutLink = document.querySelector<HTMLLinkElement>('link[rel="shortcut icon"]');
    if (!shortcutLink) {
      shortcutLink = document.createElement('link');
      shortcutLink.rel = 'shortcut icon';
      document.head.appendChild(shortcutLink);
    }
    shortcutLink.href = encoded;
  }, [currentBrandId]);

  const handleLogout = async () => {
    sessionStorage.removeItem('unitec_local_admin');
    localStorage.removeItem('unitec_show_admin');
    setShowAdminTab(false);
    setActiveTab(Tab.CHAT);
    await logOut();
    setIsLoggedIn(false);
  };

  const renderContent = () => {
    if (!isAuthReady) {
      return <div className="h-full w-full flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div></div>;
    }

    if ((activeTab === Tab.ADMIN_SETTINGS || activeTab === Tab.CALENDAR) && !isLoggedIn) {
        return <LoginScreen config={activeConfig} onLogin={() => setIsLoggedIn(true)} />;
    }

    switch (activeTab) {
      case Tab.CHAT:
        return <ChatTab 
            quickActions={QUICK_ACTIONS} 
            emergencyMode={emergencyMode} 
            language={language}
            initialMessage={initialMessage}
            customGreeting={activeConfig.customGreeting}
            bgImage={bgImage}
            brandId={currentBrandId}
        />;
      case Tab.CALL:
        return <CallTab 
            emergencyMode={emergencyMode} 
            language={language}
            voiceName={voiceName}
            voiceProvider={voiceProvider}
            customGreeting={activeConfig.customGreeting}
            brandId={currentBrandId}
        />;
      case Tab.SERVICES:
        return <ServicesTab 
            language={language}
            onConsultProduct={(productName) => {
              const initMsg = language === 'en' 
                ? "I would like to know more about " + productName 
                : "Me gustar�a saber m�s sobre " + productName;
              window.history.pushState({}, '', '?initialMessage=' + encodeURIComponent(initMsg));
              setActiveTab(Tab.CHAT);
            }}
            onAddToCart={(product, quantity) => {
              setCart(prev => {
                const existing = prev.find(item => item.product.id === product.id);
                if (existing) {
                  return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item);
                }
                return [...prev, { product, quantity }];
              });
              setIsCartOpen(true);
            }}
        />;
      case Tab.INFO:
        return <InfoTab language={language} config={activeConfig} />;
      case Tab.PRIVACY:
        return <PrivacyTab language={language} config={activeConfig} />;
      case Tab.CALENDAR:
        return <CalendarTab />;
      case Tab.ADMIN_SETTINGS:
        return <AdminDashboard 
            emergencyMode={emergencyMode}
            setEmergencyMode={setEmergencyMode}
            voiceName={voiceName}
            setVoiceName={setVoiceName}
            voiceProvider={voiceProvider}
            setVoiceProvider={setVoiceProvider}
            currentBrandId={currentBrandId}
            onToggleBrand={setCurrentBrandId}
            onUpdateBackground={setBgImage}
            language={language}
        />;
      default:
        return <ChatTab 
            quickActions={QUICK_ACTIONS} 
            emergencyMode={emergencyMode} 
            language={language}
            brandId={currentBrandId}
        />;
    }
  };

  if (isEmbedMode) {
    const embedTab = (activeTab === Tab.ADMIN_SETTINGS) ? Tab.CHAT : activeTab;
    const handleEmbedTabChange = (tab: Tab) => {
      if (tab === Tab.ADMIN_SETTINGS) {
        window.open(`${window.location.origin}/?brandId=${currentBrandId}`, '_blank');
        return;
      }
      setActiveTab(tab);
    };
    return (
      <div className="h-full w-full bg-transparent overflow-hidden">
        <Layout 
          activeTab={embedTab} 
          onTabChange={handleEmbedTabChange}
          config={activeConfig}
          onOpenDashboard={() => window.open(`${window.location.origin}/?brandId=${currentBrandId}`, "_blank")}
          language={language}
          setLanguage={setLanguage}
          onLogout={handleLogout}
          onCloseWidget={() => window.parent.postMessage("close-chatbot", "*")}
          isEmbedMode={true}
          currentBrandId={currentBrandId}
          onToggleBrand={undefined}
          cart={cart}
          onOpenCart={() => setIsCartOpen(true)}
          showAdminTab={showAdminTab}
        >
          {renderContent()}
        </Layout>
        <CartSidebar 
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          cart={cart}
          setCart={setCart}
          language={language}
        />
      </div>
    );
  }

  if (activeTab === Tab.ADMIN_SETTINGS && !isEmbedMode) {
    return (
      <div className="min-h-screen w-full bg-slate-50 flex flex-col font-sans">
        <AdminDashboard 
            emergencyMode={emergencyMode}
            setEmergencyMode={setEmergencyMode}
            voiceName={voiceName}
            setVoiceName={setVoiceName}
            voiceProvider={voiceProvider}
            setVoiceProvider={setVoiceProvider}
            currentBrandId={currentBrandId}
            onToggleBrand={setCurrentBrandId}
            onUpdateBackground={setBgImage}
            language={language}
            onBack={() => setActiveTab(Tab.CHAT)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 overflow-y-auto">
      <WebsiteLayout 
        config={activeConfig}
        onOpenDashboard={() => setActiveTab(Tab.ADMIN_SETTINGS)}
        language={language}
        setLanguage={setLanguage}
        onLogout={handleLogout}
        onCloseWidget={() => {}}
        isEmbedMode={false}
        currentBrandId={currentBrandId}
        onToggleBrand={setCurrentBrandId}
        cart={cart}
        onOpenCart={() => setIsCartOpen(true)}
        showAdminTab={showAdminTab}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        {renderContent()}
      </WebsiteLayout>
      <CartSidebar 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        setCart={setCart}
        language={language}
      />
    </div>
  );
};

export default App;




