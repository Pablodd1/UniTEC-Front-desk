import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import ChatTab from './components/ChatTab';
import CallTab from './components/CallTab';
import AdminDashboard from './components/AdminDashboard';
import CalendarTab from './components/CalendarTab';
import LoginScreen from './components/LoginScreen';
import { Tab, Language, VoiceName, VoiceProvider } from './types';
import { UNITEC_CONFIG, BUILDING_INNOVATION_CONFIG, QUICK_ACTIONS } from './constants';
import { resetChatSession } from './services/geminiService';
import { auth, logOut } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

const App: React.FC = () => {
  // Detection for Embed Mode (when used as a widget in another site)
  const isEmbedMode = new URLSearchParams(window.location.search).get('embed') === 'true';

  // Auth State (Within the widget)
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>(Tab.CHAT);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [language, setLanguage] = useState<Language>('es');
  
  // Business Identity State
  const [currentBrandId, setCurrentBrandId] = useState<'unitec' | 'building'>(() => {
    const brand = new URLSearchParams(window.location.search).get('brandId');
    if (brand === 'building' || brand === 'unitec') return brand;
    if (window.location.hostname.includes('buildinginnovation')) return 'building';
    return 'unitec';
  });
  const activeConfig = currentBrandId === 'unitec' ? UNITEC_CONFIG : BUILDING_INNOVATION_CONFIG;

  // Background State
  const [bgImage, setBgImage] = useState<string>(localStorage.getItem('unitec_custom_bg') || "https://images.unsplash.com/photo-1494412519320-aa613dfb7738?auto=format&fit=crop&q=80&w=1920");

  // Voice Settings
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>('gemini');
  const [voiceName, setVoiceName] = useState<VoiceName>('Kore');
  
  const [initialMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    const checkLocalAuth = () => sessionStorage.getItem('unitec_local_admin') === 'true';
    if (checkLocalAuth()) {
      setIsLoggedIn(true);
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user || checkLocalAuth()) {
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);



  useEffect(() => {
    resetChatSession();
  }, [emergencyMode, language, currentBrandId]);

  // Dynamically update favicon, title, lang and meta tags per brand
  useEffect(() => {
    const isUnitec = currentBrandId === 'unitec';

    // html lang always Spanish
    document.documentElement.lang = 'es';

    // Title
    document.title = isUnitec
      ? 'UNITEC USA Design | Recepcionista Virtual IA | DistribuciÃ³n Mayorista'
      : 'Building Innovation | Asistente Virtual IA | Miami, Florida';

    // meta description
    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = isUnitec
      ? 'Recepcionista virtual IA para distribuciÃ³n mayorista de materiales de construcciÃ³n. Consulta catÃ¡logo, stock en Florida y cotizaciones al instante.'
      : 'Asistente virtual IA de Building Innovation. Consulta productos, stock en Miami y conecta con ventas. AtenciÃ³n inmediata 24/7.';

    // OG tags helper
    const setOg = (property: string, val: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el); }
      el.content = val;
    };
    setOg('og:title', isUnitec ? 'UNITEC USA Design | Asistente Virtual IA' : 'Building Innovation | Asistente Virtual IA');
    setOg('og:description', isUnitec
      ? 'Consulta catÃ¡logo, stock y cotizaciones en tiempo real. Distribuidor mayorista de materiales de construcciÃ³n premium.'
      : 'Paneles WPC, pisos SPC, fachadas y mÃ¡s. Consulta disponibilidad y cotiza ahora mismo.');
    setOg('og:locale', 'es_ES');

    // SVG favicons - dark blue U for UNITEC, dark green B for Building Innovation
    const unitecSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0c4a6e"/><text x="32" y="46" font-family="Arial,sans-serif" font-weight="900" font-size="38" fill="white" text-anchor="middle">U</text></svg>';
    const buildingSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#065f46"/><text x="32" y="46" font-family="Arial,sans-serif" font-weight="900" font-size="38" fill="white" text-anchor="middle">B</text></svg>';
    const svgContent = isUnitec ? unitecSvg : buildingSvg;
    const encoded = `data:image/svg+xml,${encodeURIComponent(svgContent)}`;

    // Set <link rel="icon">
    let faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!faviconLink) {
      faviconLink = document.createElement('link');
      faviconLink.rel = 'icon';
      document.head.appendChild(faviconLink);
    }
    faviconLink.type = 'image/svg+xml';
    faviconLink.href = encoded;

    // Legacy shortcut icon
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
    // EMBED MODE: Chat + Call only. Admin lives on standalone domain (uni-tec-front-desk.vercel.app)
    const embedTab = (activeTab === Tab.ADMIN_SETTINGS) ? Tab.CHAT : activeTab;
    const handleEmbedTabChange = (tab: Tab) => {
      if (tab === Tab.ADMIN_SETTINGS) {
        // Open full Mission Control in new tab instead of inside widget
        window.open(`https://uni-tec-front-desk.vercel.app/?brandId=${currentBrandId}`, '_blank');
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
          onOpenDashboard={() => window.open(`https://uni-tec-front-desk.vercel.app/?brandId=${currentBrandId}`, "_blank")}
          language={language}
          setLanguage={setLanguage}
          onLogout={handleLogout}
          onCloseWidget={() => window.parent.postMessage("close-chatbot", "*")}
          isEmbedMode={true}
          currentBrandId={currentBrandId}
          onToggleBrand={undefined}
        >
          {renderContent()}
        </Layout>
      </div>
    );
  }

  // Standalone mode - NO background, just full page chatbot
  return (
    <div className="h-screen w-screen bg-white overflow-hidden">
      <Layout 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        config={activeConfig}
        onOpenDashboard={() => setActiveTab(Tab.ADMIN_SETTINGS)}
        language={language}
        setLanguage={setLanguage}
        onLogout={handleLogout}
        onCloseWidget={() => {}}
        isEmbedMode={false}
        currentBrandId={currentBrandId}
        onToggleBrand={setCurrentBrandId}
      >
        {renderContent()}
      </Layout>
    </div>
  );
};

export default App;



