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
    return (
      <div className="h-full w-full bg-transparent overflow-hidden">
        <Layout 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          config={activeConfig}
          onOpenDashboard={() => setActiveTab(Tab.ADMIN_SETTINGS)}
          language={language}
          setLanguage={setLanguage}
          onLogout={handleLogout}
          onCloseWidget={() => {}}
          isEmbedMode={true}
          currentBrandId={currentBrandId}
          onToggleBrand={setCurrentBrandId}
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
