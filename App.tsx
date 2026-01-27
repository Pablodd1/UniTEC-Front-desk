
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import ChatTab from './components/ChatTab';
import CallTab from './components/CallTab';
import ServicesTab from './components/ServicesTab';
import InfoTab from './components/InfoTab';
import AdminDashboard from './components/AdminDashboard';
import CalendarTab from './components/CalendarTab';
import LoginScreen from './components/LoginScreen';
import { Tab, Language, VoiceName, VoiceProvider } from './types';
import { UNITEC_CONFIG, BUILDING_INNOVATION_CONFIG, QUICK_ACTIONS, SERVICES } from './constants';
import { resetChatSession } from './services/geminiService';
import { MessageSquare, X } from 'lucide-react';

const App: React.FC = () => {
  // Widget Visibility
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  
  // Auth State (Within the widget)
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>(Tab.CHAT);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  
  // Business Identity State
  const [currentBrandId, setCurrentBrandId] = useState<'unitec' | 'building'>('unitec');
  const activeConfig = currentBrandId === 'unitec' ? UNITEC_CONFIG : BUILDING_INNOVATION_CONFIG;

  // Voice Settings
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>('gemini');
  const [voiceName, setVoiceName] = useState<VoiceName>('Kore');
  const [deepgramKey, setDeepgramKey] = useState<string>('');
  
  const [initialMessage, setInitialMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    resetChatSession();
  }, [emergencyMode, language, currentBrandId]);

  const handleConsultProduct = (productName: string) => {
    const msg = language === 'en' 
        ? `Tell me more about ${productName}` 
        : `Cuéntame más sobre ${productName}`;
    setInitialMessage(msg);
    setActiveTab(Tab.CHAT);
  };

  const renderContent = () => {
    // Force login if trying to access Admin Settings or Calendar
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
        />;
      case Tab.CALL:
        return <CallTab 
            emergencyMode={emergencyMode} 
            language={language}
            voiceName={voiceName}
            voiceProvider={voiceProvider}
            deepgramKey={deepgramKey}
        />;
      case Tab.SERVICES:
        return <ServicesTab 
            services={SERVICES} 
            language={language} 
            onConsultProduct={handleConsultProduct}
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
            deepgramKey={deepgramKey}
            setDeepgramKey={setDeepgramKey}
            currentBrandId={currentBrandId}
            onToggleBrand={setCurrentBrandId}
        />;
      case Tab.INFO:
        return <InfoTab 
            config={activeConfig} 
            language={language}
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
    <>
      {/* Background Demo Website */}
      <div className={`fixed inset-0 bg-slate-100 flex items-center justify-center -z-10 ${isWidgetOpen ? 'blur-lg grayscale-[0.2]' : ''} transition-all duration-700`}>
          <div className="text-center p-8 max-w-2xl">
              <h2 className="text-3xl md:text-5xl font-black text-slate-800 mb-6 tracking-tight">{activeConfig.name}</h2>
              <p className="text-slate-500 mb-10 leading-relaxed text-sm md:text-base">
                Professional Construction Materials Distributor. Florida-based stock.
                This page represents your existing website where the AI assistant widget will be integrated.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-40 bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex items-end">
                       <div className="w-12 h-2 bg-slate-100 rounded-full"></div>
                    </div>
                  ))}
              </div>
          </div>
      </div>

      {/* Widget Trigger Button */}
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

      {/* Widget Layout Container */}
      {isWidgetOpen && (
        <Layout 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          config={activeConfig}
          onOpenDashboard={() => setActiveTab(Tab.ADMIN_SETTINGS)}
          language={language}
          setLanguage={setLanguage}
          onLogout={() => setIsLoggedIn(false)}
          onCloseWidget={() => setIsWidgetOpen(false)}
        >
          {renderContent()}
        </Layout>
      )}
    </>
  );
};

export default App;
