
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
import { MessageSquare, X } from 'lucide-react';
import { auth, logOut } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

const App: React.FC = () => {
  // Detection for Embed Mode (when used as a widget in another site)
  const isEmbedMode = new URLSearchParams(window.location.search).get('embed') === 'true';

  // Widget Visibility
  const [isWidgetOpen, setIsWidgetOpen] = useState(isEmbedMode);
  
  // Auth State (Within the widget)
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>(Tab.CHAT);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  
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
        />;
      case Tab.CALL:
        return <CallTab 
            emergencyMode={emergencyMode} 
            language={language}
            voiceName={voiceName}
            voiceProvider={voiceProvider}
            customGreeting={activeConfig.customGreeting}
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
        />;
    }
  };

  return (
    <div className={isEmbedMode ? "h-screen w-screen overflow-hidden bg-transparent" : ""}>
      {/* Background Demo Website (Hidden in Embed Mode) */}
      {!isEmbedMode && (
        <div className={`fixed inset-0 bg-white flex flex-col -z-10 ${isWidgetOpen ? 'blur-lg grayscale-[0.2]' : ''} transition-all duration-700`}>
            <div className="absolute inset-0 -z-20 opacity-20">
                <img 
                  src={bgImage} 
                  alt="" 
                  className="w-full h-full object-cover"
                />
            </div>
            {/* Hero Section with Image */}
            <div className="relative h-[60vh] w-full overflow-hidden">
                <img 
                  src={bgImage} 
                  alt="UNITEC Design Custom Background" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-white"></div>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                    <h2 className="text-4xl md:text-7xl font-black text-white mb-4 tracking-tighter drop-shadow-2xl">{activeConfig.name}</h2>
                    <p className="text-white/90 max-w-xl text-sm md:text-lg font-medium drop-shadow-md">
                      {activeConfig.tagline || "Professional Construction Materials Distributor. Florida-based stock."}
                    </p>
                </div>
            </div>

            {/* Content Section */}
            <div className="flex-1 max-w-6xl mx-auto w-full p-12 grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { title: "Logistics", desc: "Global shipping and local distribution networks." },
                  { title: "Quality", desc: "Premium materials for high-end construction projects." },
                  { title: "Support", desc: "24/7 AI-powered customer assistance and booking." }
                ].map((item, i) => (
                  <div key={i} className="bg-slate-50 rounded-[32px] p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                     <div className="w-12 h-12 bg-brand-900 rounded-2xl mb-6 flex items-center justify-center text-accent-500 font-bold">0{i+1}</div>
                     <h3 className="text-xl font-bold text-slate-800 mb-2">{item.title}</h3>
                     <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                ))}
            </div>
        </div>
      )}

      {/* Widget Trigger Button (Hidden in Embed Mode as the Iframe is usually already the widget) */}
      {!isEmbedMode && (
        <button 
          onClick={() => setIsWidgetOpen(!isWidgetOpen)}
          className={`fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-500 hover:scale-110 active:scale-95 z-[10000] 
            ${isWidgetOpen ? 'md:bg-white md:text-slate-800 md:rotate-90 hidden md:flex' : 'bg-brand-600 text-white flex'}
          `}
        >
          {isWidgetOpen ? <X size={28} /> : (
            <div className="relative">
              <MessageSquare size={28} />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent-500 rounded-full border-2 border-brand-600 animate-pulse"></div>
            </div>
          )}
        </button>
      )}

      {/* Widget Layout Container */}
      {isWidgetOpen && (
        <div className={isEmbedMode ? "h-full w-full" : ""}>
          <Layout 
            activeTab={activeTab} 
            onTabChange={setActiveTab}
            config={activeConfig}
            onOpenDashboard={() => setActiveTab(Tab.ADMIN_SETTINGS)}
            language={language}
            setLanguage={setLanguage}
            onLogout={handleLogout}
            onCloseWidget={() => isEmbedMode ? null : setIsWidgetOpen(false)}
            isEmbedMode={isEmbedMode}
          >
            {renderContent()}
          </Layout>
        </div>
      )}
    </div>
  );
};

export default App;
