
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
  const [currentBrandId, setCurrentBrandId] = useState<'unitec' | 'building'>('unitec');
  const activeConfig = currentBrandId === 'unitec' ? UNITEC_CONFIG : BUILDING_INNOVATION_CONFIG;

  // Background State
  const [bgImage, setBgImage] = useState<string>(localStorage.getItem('unitec_custom_bg') || "https://images.unsplash.com/photo-1494412519320-aa613dfb7738?auto=format&fit=crop&q=80&w=1920");

  // Voice Settings
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
    // Populate strong chat history for training if empty
    const existingHistory = localStorage.getItem('unitec_chat_history');
    if (!existingHistory || JSON.parse(existingHistory).length === 0) {
      const trainingHistory = [
        { role: 'user', text: 'Hello, do you have WPC panels for exterior use?', timestamp: new Date(Date.now() - 3600000 * 24).toISOString() },
        { role: 'assistant', text: 'Hello! Yes, we have a wide variety of WPC panels specifically designed for exterior use. They are 100% waterproof and come with a 15-year warranty. Would you like to see some wood-tone options like Oak or Teak?', timestamp: new Date(Date.now() - 3600000 * 23.9).toISOString() },
        { role: 'user', text: 'Yes, show me the Oak ones. Also, do you ship to Mexico?', timestamp: new Date(Date.now() - 3600000 * 23.8).toISOString() },
        { role: 'assistant', text: 'Excellent choice. Our "FACHADA DECK ROBLE" (Ref: 14091101) is very popular. Regarding shipping, yes, we deliver anywhere in the world! The shipping price depends on the destination country. For Mexico, I can get you a specific quote. How many square meters do you need?', timestamp: new Date(Date.now() - 3600000 * 23.7).toISOString() },
        { role: 'user', text: 'I need about 45 square meters. Can I return them if I don\'t like the color?', timestamp: new Date(Date.now() - 3600000 * 2).toISOString() },
        { role: 'assistant', text: 'For 45m², the total for the Roble panels would be approximately $3,113,955 COP (plus shipping). Please note that we have a strict policy: there are no returns or exchanges, so I recommend reviewing the technical sheet or visiting our showroom in Doral if you are nearby to be 100% sure of the tone!', timestamp: new Date(Date.now() - 3600000 * 1.9).toISOString() },
        { role: 'user', text: 'Understood. Do you offer any discounts for bulk orders?', timestamp: new Date(Date.now() - 3600000 * 1.8).toISOString() },
        { role: 'assistant', text: 'Yes! Both regular and bulk discounts are available. For an order of 45m², you qualify for our professional tier discount. Would you like me to send the official quote to your email?', timestamp: new Date(Date.now() - 3600000 * 1.7).toISOString() }
      ];
      localStorage.setItem('unitec_chat_history', JSON.stringify(trainingHistory));
    }
  }, []);

  useEffect(() => {
    resetChatSession();
  }, [emergencyMode, language, currentBrandId]);

  const handleLogout = async () => {
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
      <div className="h-screen w-screen bg-transparent overflow-hidden">
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

  // Standalone mode is a beautiful review card mock, with nothing else on the screen
  return (
    <div className="min-h-screen w-screen bg-slate-950 flex items-center justify-center p-0 md:p-6 overflow-hidden relative">
      <div className="absolute inset-0 bg-cover bg-center opacity-30 blur-2xl pointer-events-none scale-105" style={{ backgroundImage: `url(${bgImage})` }}></div>
      <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-950"></div>
      
      {/* Premium Widget Card Container */}
      <div className="w-full max-w-[440px] h-[100vh] md:h-[840px] bg-white rounded-none md:rounded-[40px] shadow-2xl relative flex flex-col overflow-hidden z-10 animate-in zoom-in-95 duration-500">
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
    </div>
  );
};

export default App;
